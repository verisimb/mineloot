require('dotenv').config();
const { ethers } = require('ethers');
const { EventSource } = require('eventsource');
const fs = require('fs');
const path = require('path');

const ALCHEMY_URL = process.env.ALCHEMY_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!ALCHEMY_URL || !PRIVATE_KEY) {
    console.error("[FATAL] Missing ALCHEMY_URL or PRIVATE_KEY in .env file.");
    process.exit(1);
}

const REPORT_FILE = path.join(__dirname, 'mineloot-latest-report.txt');

function logReport(msg) {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${msg}\n`;
    console.log(logLine.trim());
    try {
        fs.appendFileSync(REPORT_FILE, logLine);
    } catch (err) {
        console.error("Failed to write to report file:", err);
    }
}

// Setup Ethers Provider & Wallet
const provider = new ethers.JsonRpcProvider(ALCHEMY_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// GridMining Contract Address & Minimal ABI
const GRID_MINING_ADDRESS = '0xA8E2F506aDcbBF18733A9F0f32e3D70b1A34d723';
const gridMiningAbi = [
    "function deploy(uint8[] calldata blockIds) external payable",
    "function claimETH() external",
    "function claimLOOT() external"
];

const gridMining = new ethers.Contract(GRID_MINING_ADDRESS, gridMiningAbi, wallet);

logReport(`[BOT] Starting Mineloot Auto-Miner Bot for wallet: ${wallet.address}`);

let isClaiming = false;
let lastClaimTime = 0;
const processedRounds = new Set();

async function executeDeploy(roundId) {
    if (processedRounds.has(roundId)) return;
    processedRounds.add(roundId);

    // Bersihkan memori Set agar tidak semrawut
    if (processedRounds.size > 20) {
        const firstItem = processedRounds.values().next().value;
        processedRounds.delete(firstItem);
    }

    try {
        // Deploy to all 25 blocks (0 to 24)
        const blockIds = Array.from({length: 25}, (_, i) => i);
        // Total value: 0.00025 ETH (which is 0.00001 ETH per block)
        const txValue = ethers.parseEther("0.00025");

        // Cek saldo wallet utama! Butuh sekitar 0.00026 ETH (untuk modal ronde + gas)
        const balance = await wallet.provider.getBalance(wallet.address);
        if (balance < ethers.parseEther("0.00026")) {
            logReport(`[WARNING] Saldo dompet asli menipis. Ronde ${roundId} dibatalkan sementara!`);
            logReport(`[FORCE CLAIM] Mencetuskan klaim paksa untuk menambah nafas...`);
            await checkProfit(true);
            return;
        }

        logReport(`[INFO] Round ${roundId} | Preparing to deploy 0.00025 ETH to 25 blocks...`);

        // Send Transaction
        const tx = await gridMining.deploy(blockIds, { value: txValue });
        logReport(`[SUCCESS] Round ${roundId} | Tx Sent: ${tx.hash}`);

        // Wait for connection / mined
        const receipt = await tx.wait(1);
        logReport(`[SUCCESS] Round ${roundId} | Tx Mined in block ${receipt.blockNumber}`);
    } catch (error) {
        logReport(`[ERROR] Round ${roundId} | Deploy failed: ${error.message}`);
    }
}

async function checkProfit(forceClaimAll = false) {
    if (isClaiming) return;
    
    // API Mineloot sering delay dalam mengukur saldo setelah ditarik (~30 detik lambatnya).
    // Kita paksakan masa tunggu (cooldown) 45 detik agar bot tidak mem-bombardir contract claimETH/claimLOOT berulang kali.
    if (Date.now() - lastClaimTime < 45000) {
        if (forceClaimAll) logReport(`[SYNC] Menunggu sinkronisasi API backend Mineloot. Siklus dilewati...`);
        return; 
    }

    try {
        const res = await fetch(`https://api.mineloot.app/api/user/${wallet.address}/rewards`);
        if (res.ok) {
            const data = await res.json();
            const pendingEth = data?.pendingETHFormatted || "0.0";
            const pendingLoot = data?.pendingLOOT?.netFormatted || "0.0";
            
            // Supaya terminal tidak terlalu berisik saat spam forceClaimAll berulang
            if (!forceClaimAll) {
                logReport(`[PROFIT INFO] Total Balance (Pending): ${pendingEth} ETH | ${pendingLoot} LOOT`);
            }

            let claimedSomething = false;

            // Tarik ETH jika dipaksa karena dompet habis, atau memang saldonya sudah > 0.0002
            if (forceClaimAll || parseFloat(pendingEth) >= 0.0002) {
                if (parseFloat(pendingEth) > 0) {
                    isClaiming = true;
                    logReport(`[CLAIM] Saldo ETH pending: ${pendingEth}. Menarik ETH...`);
                    try {
                        const txEth = await gridMining.claimETH();
                        logReport(`[CLAIM] Transaksi ETH dikirim: ${txEth.hash}`);
                        await txEth.wait(1);
                        logReport(`[CLAIM SUCCESS] ETH berhasil ditarik!`);
                        claimedSomething = true;
                    } catch (e) {
                         logReport(`[CLAIM ERROR] Gagal menarik ETH: ${e.message}`);
                    }
                    isClaiming = false;
                }
            }

            // Tarik LOOT khusus saat dompet habis untuk meringankan margin
            if (forceClaimAll && parseFloat(pendingLoot) > 0) {
                isClaiming = true;
                logReport(`[CLAIM] Saldo LOOT pending: ${pendingLoot}. Menarik LOOT...`);
                try {
                    const txLoot = await gridMining.claimLOOT();
                    logReport(`[CLAIM] Transaksi LOOT dikirim: ${txLoot.hash}`);
                    await txLoot.wait(1);
                    logReport(`[CLAIM SUCCESS] LOOT berhasil ditarik!`);
                    claimedSomething = true;
                } catch (e) {
                    logReport(`[CLAIM ERROR] Gagal menarik LOOT: ${e.message}`);
                }
                isClaiming = false;
            }

            if (claimedSomething) {
                lastClaimTime = Date.now();
            }
        }
    } catch (err) {
        isClaiming = false;
        logReport(`[PROFIT ERROR] Gagal cek saldo: ${err.message}`);
    }
}

function startListening() {
    logReport(`[SSE] Connecting to Stream URL: https://api.mineloot.app/api/events/rounds`);
    const es = new EventSource('https://api.mineloot.app/api/events/rounds');

    es.onerror = (err) => {
        logReport(`[SSE ERROR] Connection error. Reconnecting in 5 seconds...`);
        es.close();
        setTimeout(startListening, 5000);
    };

    es.addEventListener('roundTransition', async (e) => {
        try {
            const data = JSON.parse(e.data);
            const newRound = data?.newRound;
            const settled = data?.settled;
            
            if (settled && settled.roundId) {
                 logReport(`[INFO] Round ${settled.roundId} settled. Winning Block: ${settled.winningBlock}`);
                 
                 // Berikan jeda 5 detik untuk memberi waktu backend memperbarui saldo
                 setTimeout(checkProfit, 5000);
            }

            if (newRound && newRound.roundId) {
                logReport(`[NEW ROUND] ID: ${newRound.roundId} | Started`);
                await executeDeploy(newRound.roundId);
            }
        } catch (err) {
            logReport(`[INTERNAL ERROR] Failed to parse SSE event: ${err.message}`);
        }
    });

    // Also log deployed events to track competition if needed
    // es.addEventListener('deployed', (e) => {});
}

// Start bot: Force claim all existing rewards, then start listening
logReport(`[STARTUP] Mengeksekusi 'Klaim Semua' sebelum mendengarkan ronde baru...`);
checkProfit(true).then(() => {
    startListening();
});
