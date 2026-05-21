// app.js - SolAudit Interactive Sandbox & Telemetry Engine

// Initial dataset seed for visual fidelity
const INITIAL_WALLETS = [
    "3tGhNkPqBmVrLwDsAeCjXfYuIoZpMnQvKsWlRdEaTbFc",
    "7xK9mQ3fRpLzNsVWjCdBuAeYgTh2oP5rDwMiXlFvEqJy",
    "G2x9nLaKp8sRtVyCdMfYeTh1oA2rPwMiDlFvEqJbFcTs",
    "4mPqKrNwLaEsVtBjYcFuXdIhGzRoAeWmQnDvKsJlTbCy",
    "9aFrBwGnKlPsQvMcXjYhTdUiZeRoWmNqDsEtLkAyCbFv"
];

const PREDICATES = {
    KYC_AML_COMBINED: {
        name: "KYC/AML Combined Verification",
        checks: ["GOVERNMENT_ID_VERIFIED", "LIVENESS_CHECK_PASSED", "OFAC_SDN_CLEAR", "PEP_SCREENING_CLEAR"]
    },
    OFAC_SDN_SCREEN: {
        name: "OFAC Sanctions & SDN Screening",
        checks: ["OFAC_SDN_CLEAR", "PEP_SCREENING_CLEAR"]
    },
    PEP_SCREENING: {
        name: "Politically Exposed Person check",
        checks: ["PEP_SCREENING_CLEAR", "AMLD6_COMPLIANT"]
    },
    TRAVEL_RULE_ID: {
        name: "FATF Recommendation 16 (Travel Rule)",
        checks: ["ORIGINATOR_ID_VERIFIED", "BENEFICIARY_ID_VERIFIED", "THRESHOLD_LIMIT_PASSED"]
    }
};

const ISSUERS = {
    "node-meridian": { name: "Meridian Identity Corp.", jurisdiction: "US", accreditation: "FINTRAC #2024-0182" },
    "node-steppe": { name: "Steppe Cryptographic Attesters", jurisdiction: "KZ", accreditation: "AIFC #2026-0045" },
    "node-zurich": { name: "Zurich Trust Labs", jurisdiction: "CH", accreditation: "FINMA #2025-0812" }
};

let telemetryInterval = null;
let auditBlocks = [];
let oracleNodes = [];
let governanceProposals = [];
let isCpiEnabled = false;
let currentAttestationData = null; // Store issued attestation

// Sound effects wrapper using base64 audio
function playClickSound() {
    try {
        const audio = document.getElementById('audio-click');
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }
    } catch (e) {}
}

// Helper to truncate address
function truncateAddr(addr, leading = 6, trailing = 4) {
    if (!addr) return "";
    return `${addr.substring(0, leading)}...${addr.substring(addr.length - trailing)}`;
}

// Generate random Solana address
function generateRandomWallet() {
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let addr = "";
    for (let i = 0; i < 44; i++) {
        addr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return addr;
}

// Initialize System Data
function initSystem() {
    // 1. Generate Oracle Nodes list
    oracleNodes = [
        { name: "SD-Node-01", location: "San Diego, USA", stake: 48250, ping: "14ms", status: "ACTIVE" },
        { name: "Almaty-Core-02", location: "Almaty, Kazakhstan", stake: 32400, ping: "38ms", status: "ACTIVE" },
        { name: "Munich-Gate-03", location: "Munich, Germany", stake: 52100, ping: "22ms", status: "ACTIVE" },
        { name: "SG-Validator-04", location: "Singapore", stake: 29800, ping: "45ms", status: "ACTIVE" },
        { name: "CH-Consensus-05", location: "Zurich, Switzerland", stake: 44300, ping: "18ms", status: "ACTIVE" }
    ];
    renderOracleNodes();

    // 2. Generate Governance Proposals
    governanceProposals = [
        { id: "SAP-04", title: "Update OFAC SDN Hash Coordinates for May 2026", type: "OFAC", votesYes: 182400, votesNo: 1200, status: "PASSED" },
        { id: "SAP-05", title: "Increase FATF Travel Rule trigger threshold to $3,000 equivalent", type: "THRESHOLD", votesYes: 94200, votesNo: 48100, status: "ACTIVE" },
        { id: "SAP-06", title: "Deprecate Steppe Credential Issuer validation key #082", type: "JURISDICTION", votesYes: 120400, votesNo: 300, status: "PASSED" }
    ];
    renderGovernanceProposals();

    // 3. Pre-load default audit blocks in timeline
    auditBlocks = [
        {
            seq: 10482,
            type: "ISSUANCE",
            subject: "7xK9mQ3fRpLzNsVWjCdBuAeYgTh2oP5rDwMiXlFvEqJy",
            issuer: "Zurich Trust Labs",
            predicate: "KYC_AML_COMBINED",
            hash: "5nBsLrOwMbFtVcAkZdGuYeIjHaSpBfXnRqEwNvKmTdCl",
            prevHash: "9aFrBwGnKlPsQvMcXjYhTdUiZeRoWmNqDsEtLkAyCbFv",
            timestamp: Date.now() - 3600000 * 2,
            status: "VERIFIED"
        },
        {
            seq: 10481,
            type: "ISSUANCE",
            subject: "4mPqKrNwLaEsVtBjYcFuXdIhGzRoAeWmQnDvKsJlTbCy",
            issuer: "Meridian Identity Corp.",
            predicate: "OFAC_SDN_SCREEN",
            hash: "2pQtMuNaKcFsWvBjYeGrXdIhLzRoDeWmAnEqJkTbCs",
            prevHash: "3tGhNkPqBmVrLwDsAeCjXfYuIoZpMnQvKsWlRdEaTbFc",
            timestamp: Date.now() - 3600000 * 4,
            status: "VERIFIED"
        },
        {
            seq: 10480,
            type: "REVOCATION",
            subject: "G2x9nLaKp8sRtVyCdMfYeTh1oA2rPwMiDlFvEqJbFcTs",
            issuer: "Steppe Cryptographic Attesters",
            predicate: "KYC_AML_COMBINED",
            hash: "9aFrBwGnKlPsQvMcXjYhTdUiZeRoWmNqDsEtLkAyCbFv",
            prevHash: "7xK9mQ3fRpLzNsVWjCdBuAeYgTh2oP5rDwMiXlFvEqJy",
            timestamp: Date.now() - 3600000 * 8,
            status: "VERIFIED"
        }
    ];
    renderAuditTimeline();

    // 4. Start Telemetry Feed
    startTelemetry();
}

// Start Random Telemetry Feeds to make page feel alive and interactive
function startTelemetry() {
    const feed = document.getElementById("event-feed");
    const violations = document.getElementById("violation-feed");
    const statAttestations = document.getElementById("stat-attestations");
    const statAudited = document.getElementById("stat-audited");
    const statUnlocked = document.getElementById("stat-unlocked");

    let countAttestations = 584291;
    let countAudited = 12.8;
    let countUnlocked = 512;

    telemetryInterval = setInterval(() => {
        // Random check event
        if (Math.random() > 0.3) {
            countAttestations += Math.floor(Math.random() * 3) + 1;
            countAudited += 0.01;
            if (Math.random() > 0.8) {
                countUnlocked += Math.floor(Math.random() * 2) + 1;
            }

            statAttestations.innerText = countAttestations.toLocaleString();
            statAudited.innerText = countAudited.toFixed(2) + "M";
            statUnlocked.innerText = "$" + countUnlocked + "M";

            // Add feed item
            const newEvent = {
                wallet: generateRandomWallet(),
                type: Math.random() > 0.85 ? "REVOKE" : "VERIFY",
                predicate: Object.keys(PREDICATES)[Math.floor(Math.random() * 4)],
                issuer: Object.values(ISSUERS)[Math.floor(Math.random() * 3)].name,
                time: "1s ago"
            };

            const item = document.createElement("div");
            item.className = `feed-item ${newEvent.type}`;
            item.innerHTML = `
                <div class="feed-left">
                    <span class="feed-icon">${newEvent.type === 'VERIFY' ? '✅' : '🚨'}</span>
                    <div>
                        <span class="feed-wallet">${truncateAddr(newEvent.wallet, 6, 4)}</span>
                        <div class="feed-issuer">${newEvent.issuer}</div>
                    </div>
                </div>
                <div class="feed-right">
                    <span class="feed-predicate">${newEvent.predicate}</span>
                    <span class="feed-status ${newEvent.type === 'VERIFY' ? 'active' : 'revoked'}">
                        ${newEvent.type === 'VERIFY' ? 'PASS' : 'REVOKED'}
                    </span>
                    <span class="feed-time">${newEvent.time}</span>
                </div>
            `;

            feed.prepend(item);
            if (feed.children.length > 8) {
                feed.removeChild(feed.lastChild);
            }

            // Flag simulated OFAC warning
            if (newEvent.type === 'REVOKE') {
                const alertItem = document.createElement("div");
                alertItem.className = "violation-item";
                alertItem.innerHTML = `
                    <div class="violation-left">
                        <span class="violation-title">⚠️ SANCTIONS REVOCATION</span>
                        <span class="violation-address">${truncateAddr(newEvent.wallet, 8, 6)}</span>
                    </div>
                    <span class="violation-action">GATED</span>
                `;
                violations.prepend(alertItem);
                if (violations.children.length > 5) {
                    violations.removeChild(violations.lastChild);
                }
            }
        }
    }, 4500);
}

// Render Oracles List
function renderOracleNodes() {
    const list = document.getElementById("oracle-node-list");
    list.innerHTML = "";
    oracleNodes.forEach(node => {
        const row = document.createElement("div");
        row.className = "oracle-node-row";
        row.innerHTML = `
            <div class="node-info">
                <span class="node-dot"></span>
                <div>
                    <div class="node-name">${node.name}</div>
                    <div class="node-location">${node.location}</div>
                </div>
            </div>
            <div class="node-metrics">
                <span class="node-stake">💎 ${node.stake.toLocaleString()} SOL</span>
                <span class="node-ping">⚡ ${node.ping}</span>
            </div>
        `;
        list.appendChild(row);
    });
}

// Render Governance Proposals
function renderGovernanceProposals() {
    const list = document.getElementById("gov-proposals");
    list.innerHTML = "";
    governanceProposals.forEach(prop => {
        const row = document.createElement("div");
        row.className = "proposal-row";
        row.innerHTML = `
            <div class="proposal-meta">
                <span class="prop-badge ${prop.status.toLowerCase()}">${prop.status}</span>
                <span class="proposal-votes">👍 ${prop.votesYes.toLocaleString()} | 👎 ${prop.votesNo.toLocaleString()}</span>
            </div>
            <div class="proposal-title">${prop.id}: ${prop.title}</div>
            ${prop.status === 'ACTIVE' ? `
                <div class="proposal-actions">
                    <button class="btn-vote yes" onclick="voteProposal('${prop.id}', 'yes')">VOTE YES</button>
                    <button class="btn-vote no" onclick="voteProposal('${prop.id}', 'no')">VOTE NO</button>
                </div>
            ` : ''}
        `;
        list.appendChild(row);
    });
}

// Handle governance vote clicks
window.voteProposal = function(id, direction) {
    playClickSound();
    const prop = governanceProposals.find(p => p.id === id);
    if (prop) {
        if (direction === 'yes') {
            prop.votesYes += 12800; // add simulated stake weight
        } else {
            prop.votesNo += 9200;
        }
        renderGovernanceProposals();
    }
};

// Render Audit Timeline Chain
function renderAuditTimeline() {
    const timeline = document.getElementById("chain-timeline");
    timeline.innerHTML = "";
    auditBlocks.forEach(block => {
        const item = document.createElement("div");
        item.className = "chain-block";
        item.dataset.seq = block.seq;
        item.innerHTML = `
            <div class="block-header">
                <span class="block-num">EVENT ACCOUNT PDA [Seq: ${block.seq}]</span>
                <span class="block-ts">${new Date(block.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="block-desc">${block.type} -> ${truncateAddr(block.subject, 8, 8)}</div>
            <div class="block-hash">Hash: ${block.hash}</div>
        `;
        item.addEventListener("click", () => {
            playClickSound();
            document.querySelectorAll(".chain-block").forEach(b => b.classList.remove("active"));
            item.classList.add("active");
            showBlockDetails(block);
        });
        timeline.appendChild(item);
    });
}

// Generate cryptographic hash for proof visualizer
function getSHA256(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0') + Math.abs(hash * 3).toString(16).padEnd(24, 'f');
}

// Display selected audit block specifications & Merkle Proof verification
function showBlockDetails(block) {
    const detailPanel = document.getElementById("block-details-content");
    const rootHash = getSHA256(block.hash + block.prevHash);
    const parentHash = getSHA256(rootHash + "solaudit-system-anchor-key");

    detailPanel.innerHTML = `
        <div class="details-wrapper">
            <div class="merkle-proof-visualizer">
                <h4>Dynamic Merkle Proof Verification</h4>
                <div class="merkle-tree-flow">
                    <div class="tree-node verified">
                        <span>Merkle Tree Root (PDA link state)</span>
                        <span class="node-hash">${truncateAddr(parentHash, 10, 10)}</span>
                    </div>
                    <div class="tree-node">
                        <span>Subtree Leaf Hash (Transaction block)</span>
                        <span class="node-hash">${truncateAddr(rootHash, 10, 10)}</span>
                    </div>
                    <div class="tree-node">
                        <span>Attestation Payload Hash [Seq ${block.seq}]</span>
                        <span class="node-hash">${truncateAddr(block.hash, 10, 10)}</span>
                    </div>
                </div>
            </div>

            <div class="pda-data-grid">
                <div class="pda-field">
                    <span class="pda-field-label">Subject Address</span>
                    <div class="pda-field-value">${truncateAddr(block.subject, 6, 6)}</div>
                </div>
                <div class="pda-field">
                    <span class="pda-field-label">Accredited Issuer</span>
                    <div class="pda-field-value">${block.issuer}</div>
                </div>
                <div class="pda-field">
                    <span class="pda-field-label">Predicate Standard</span>
                    <div class="pda-field-value">${block.predicate}</div>
                </div>
                <div class="pda-field">
                    <span class="pda-field-label">Linked Block ID</span>
                    <div class="pda-field-value">Slot #51,894,${block.seq}</div>
                </div>
            </div>
            
            <div class="cpi-tester">
                <h4>On-Chain Integrity Attestation Status</h4>
                <p class="small-desc" style="color: var(--color-green); font-weight: 700;">✅ Ledger verification passed. cryptographic proof matches anchoring state.</p>
            </div>
        </div>
    `;
}

// Prover Terminal Simulation Engine
function simulateAttestationIssuance(wallet, predicate, issuer, isZkp) {
    const term = document.getElementById("simulator-terminal");
    term.innerHTML = "";
    isCpiEnabled = false;
    document.getElementById("btn-cpi-verify").disabled = true;

    const addLine = (txt, styleClass = "") => {
        const line = document.createElement("div");
        line.className = `term-line ${styleClass}`;
        line.innerText = txt;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
    };

    addLine(`[SYSTEM] Starting verification workflow for: ${truncateAddr(wallet, 8, 8)}`, "system");
    
    setTimeout(() => {
        addLine(`[DATABASE] Querying compliance database for AML & OFAC checks...`);
    }, 300);

    setTimeout(() => {
        addLine(`[CONSENSUS] Node check passed. Sanitization clean. Subject is not a restricted person.`);
    }, 700);

    setTimeout(() => {
        if (isZkp) {
            addLine(`[PROVER] Initializing Groth16 circuit proving state...`, "info");
            addLine(`[PROVER] Generating ZK-SNARK witness for predicates:`);
            PREDICATES[predicate].checks.forEach(check => {
                addLine(`   - verify_statement::[${check}] -> satisfied`);
            });
        }
    }, 1200);

    setTimeout(() => {
        if (isZkp) {
            addLine(`[PROVER] Groth16 proving phase finished. Time taken: 248ms`, "success");
            addLine(`[PROVER] Proof signature computed: 0x5a18c...${Math.floor(Math.random()*900000+100000).toString(16)}`, "success");
        }
    }, 1800);

    setTimeout(() => {
        addLine(`[LEDGER] Crafting transaction envelope...`);
        addLine(`[LEDGER] Deriving program PDA credentials address...`);
        const pdaAddress = generateRandomWallet();
        addLine(`   - Seed derivation: [solaudit_cred, ${truncateAddr(wallet, 4, 4)}, ${predicate}]`);
        addLine(`   - Derived address: ${pdaAddress}`, "info");
    }, 2400);

    setTimeout(() => {
        addLine(`[LEDGER] Submitting issue_attestation transaction...`);
        addLine(`[LEDGER] Processing Anchor state constraints...`);
    }, 3000);

    setTimeout(() => {
        const txHash = getSHA256(wallet + Date.now().toString());
        const seq = auditBlocks.length > 0 ? auditBlocks[0].seq + 1 : 10001;
        
        currentAttestationData = {
            seq: seq,
            type: "ISSUANCE",
            subject: wallet,
            issuer: ISSUERS[issuer].name,
            predicate: predicate,
            hash: txHash,
            prevHash: auditBlocks.length > 0 ? auditBlocks[0].hash : "0x000000",
            timestamp: Date.now(),
            status: "VERIFIED"
        };

        // Append to block timeline
        auditBlocks.unshift(currentAttestationData);
        renderAuditTimeline();

        addLine(`[SUCCESS] Attestation issued successfully! PDA initialized.`, "success");
        addLine(`[LEDGER] Transaction Hash: ${txHash}`, "success");
        addLine(`[LEDGER] Anchored on slot: 182,492,028`, "success");
        
        // Enable CPI trigger
        isCpiEnabled = true;
        document.getElementById("btn-cpi-verify").disabled = false;
        
    }, 3600);
}

// Simulate Cross-Program Invocation verification gate
function simulateCpiVerification() {
    if (!isCpiEnabled || !currentAttestationData) return;
    const term = document.getElementById("simulator-terminal");
    
    const addLine = (txt, styleClass = "") => {
        const line = document.createElement("div");
        line.className = `term-line ${styleClass}`;
        line.innerText = txt;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
    };

    addLine(`\n[CPI-RUN] Invoking verify_attestation CPI gate...`, "system");
    
    setTimeout(() => {
        addLine(`[CPI-RUN] DeFi lending pool smart contract -> verify_attestation()`);
        addLine(`[CPI-RUN] Read payload credentials from PDA account: slot audit-registry`);
    }, 400);

    setTimeout(() => {
        addLine(`[CPI-RUN] Verification predicate targets: ${currentAttestationData.predicate}`);
        addLine(`[CPI-RUN] Evaluating ZK Proof inputs with on-chain Groth16 Verification Key...`);
    }, 900);

    setTimeout(() => {
        addLine(`[CPI-RUN] Verification Key: 4mPqKrNwLaEsVtBjYcFuXdIhGzRoAeWmQnDvKsJlTbCy`);
        addLine(`[CPI-RUN] Result: SUCCESS — Cryptographic identity constraints met.`, "success");
        addLine(`[CPI-RUN] Gated swap / borrow instruction cleared for execution!`, "success");
    }, 1400);
}

// Setup Event Listeners
function setupListeners() {
    // Nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            playClickSound();
        });
    });

    // Randomize wallet btn
    document.getElementById("btn-rand-wallet").addEventListener("click", () => {
        playClickSound();
        document.getElementById("sim-wallet").value = generateRandomWallet();
    });

    // Issue Attestation btn
    document.getElementById("btn-issue").addEventListener("click", () => {
        playClickSound();
        const wallet = document.getElementById("sim-wallet").value.trim();
        const predicate = document.getElementById("sim-predicate").value;
        const issuer = document.getElementById("sim-issuer").value;
        const isZkp = document.getElementById("sim-zkp-active").checked;

        if (wallet.length < 32) {
            alert("Please enter a valid Solana wallet address (32+ chars).");
            return;
        }

        simulateAttestationIssuance(wallet, predicate, issuer, isZkp);
    });

    // CPI verification invoke btn
    document.getElementById("btn-cpi-verify").addEventListener("click", () => {
        playClickSound();
        simulateCpiVerification();
    });

    // Proposal submissions
    document.getElementById("btn-submit-proposal").addEventListener("click", () => {
        playClickSound();
        const title = document.getElementById("prop-title").value.trim();
        const type = document.getElementById("prop-type").value;

        if (!title) {
            alert("Please enter a title for the governance proposal.");
            return;
        }

        const newId = `SAP-0${governanceProposals.length + 4}`;
        governanceProposals.push({
            id: newId,
            title: title,
            type: type,
            votesYes: 1000, // starting vote weight
            votesNo: 0,
            status: "ACTIVE"
        });

        document.getElementById("prop-title").value = "";
        renderGovernanceProposals();
        
        // Output confirmation into Prove terminal
        const term = document.getElementById("simulator-terminal");
        const line = document.createElement("div");
        line.className = "term-line warning";
        line.innerText = `[GOVERNANCE] New proposal ${newId} submitted to governance registry registry lock.`;
        term.appendChild(line);
    });

    // Tab buttons switching
    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.addEventListener('click', () => {
            playClickSound();
            document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            const targetId = `tab-${tab.dataset.tab}`;
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// Window load init
window.addEventListener("DOMContentLoaded", () => {
    initSystem();
    setupListeners();
});
