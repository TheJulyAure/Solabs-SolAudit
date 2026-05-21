// app.js - SolAudit Interactive Compliance Engine & Dashboard Controller

// Seed Wallets
const INITIAL_WALLETS = [
    "3tGhNkPqBmVrLwDsAeCjXfYuIoZpMnQvKsWlRdEaTbFc",
    "7xK9mQ3fRpLzNsVWjCdBuAeYgTh2oP5rDwMiXlFvEqJy",
    "G2x9nLaKp8sRtVyCdMfYeTh1oA2rPwMiDlFvEqJbFcTs",
    "4mPqKrNwLaEsVtBjYcFuXdIhGzRoAeWmQnDvKsJlTbCy",
    "9aFrBwGnKlPsQvMcXjYhTdUiZeRoWmNqDsEtLkAyCbFv"
];

// Seed Rule Predicates
const RULE_PRESETS = {
    KYC_AML_COMBINED: ["GOVERNMENT_ID_VERIFIED", "LIVENESS_CHECK_PASSED", "OFAC_SDN_CLEAR", "PEP_SCREENING_CLEAR"],
    OFAC_SDN_SCREEN: ["OFAC_SDN_CLEAR", "PEP_SCREENING_CLEAR"],
    PEP_SCREENING: ["PEP_SCREENING_CLEAR", "AMLD6_COMPLIANT"],
    TRAVEL_RULE_ID: ["ORIGINATOR_ID_VERIFIED", "BENEFICIARY_ID_VERIFIED", "THRESHOLD_LIMIT_PASSED"]
};

// Initial state variables
let connectedWallet = null;
let currentRules = [...RULE_PRESETS.KYC_AML_COMBINED];
let isCpiEnabled = false;
let currentAttestationData = null;
let telemetryInterval = null;
let chartInterval = null;

// Mock Data Arrays
let auditBlocks = [];
let oracleNodes = [];
let governanceProposals = [];
let chartDataPoints = [420, 480, 450, 520, 610, 590, 640, 720, 680, 750, 810, 780, 840, 890, 920];

// Main statistics
let statAttestationsVal = 584291;
let statAuditedVal = 12.8;
let statLatencyVal = 340;
let statCapitalVal = 512;

// sound player helper
function playClick() {
    try {
        const audio = document.getElementById("audio-click");
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => {});
        }
    } catch(e) {}
}

// Generate random wallet address
function generateRandomAddress() {
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let addr = "";
    for (let i = 0; i < 44; i++) {
        addr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return addr;
}

// Truncate address helper
function truncateAddress(addr, lead = 6, tail = 4) {
    if (!addr) return "";
    if (addr.length <= lead + tail) return addr;
    return `${addr.substring(0, lead)}...${addr.substring(addr.length - tail)}`;
}

// SHA-256 helper for proofs
function computeMockHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0') + Math.abs(hash * 37).toString(16).padEnd(24, 'f');
}

// ----------------------------------------------------
// System Initialization
// ----------------------------------------------------
function initDashboard() {
    // 1. Initial Oracle nodes config
    oracleNodes = [
        { id: "node-meridian", name: "SD-Node-01 (Meridian Corp)", location: "San Diego, USA", stake: 48250, ping: 14, status: "ACTIVE" },
        { id: "node-steppe", name: "Almaty-Core-02 (Steppe)", location: "Almaty, KZ", stake: 32400, ping: 38, status: "ACTIVE" },
        { id: "node-zurich", name: "Munich-Gate-03 (Zurich Labs)", location: "Zurich, CH", stake: 52100, ping: 18, status: "ACTIVE" },
        { id: "node-sg", name: "SG-Validator-04 (Singapore)", location: "Singapore, SG", stake: 29800, ping: 45, status: "ACTIVE" }
    ];
    renderOracleNodesList();
    populateStakingNodeDropdown();

    // 2. Initial proposals config
    governanceProposals = [
        { id: "SAP-04", title: "Update OFAC SDN List Coordinates for Q3 2026", type: "OFAC", votesYes: 182400, votesNo: 1200, status: "PASSED" },
        { id: "SAP-05", title: "Adjust FATF Travel Rule trigger threshold to $3,000", type: "THRESHOLD", votesYes: 94200, votesNo: 48100, status: "ACTIVE" },
        { id: "SAP-06", title: "Deprecate Steppe Credential Issuer signing key #8", type: "JURISDICTION", votesYes: 120400, votesNo: 300, status: "PASSED" }
    ];
    renderProposalsList();

    // 3. Initial blocks config
    auditBlocks = [
        {
            seq: 10842,
            type: "ISSUANCE",
            subject: "7xK9mQ3fRpLzNsVWjCdBuAeYgTh2oP5rDwMiXlFvEqJy",
            issuer: "Zurich Trust Labs",
            predicate: "KYC_AML_COMBINED",
            hash: computeMockHash("7xK9mQ3fRpLzNsVWjCdBuAeYgTh2oP5rDwMiXlFvEqJy" + "Zurich Trust Labs"),
            prevHash: "f6a8b72c91834ea01d2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
            timestamp: Date.now() - 3600000 * 2,
            rules: ["GOVERNMENT_ID_VERIFIED", "OFAC_SDN_CLEAR"],
            status: "VERIFIED"
        },
        {
            seq: 10841,
            type: "ISSUANCE",
            subject: "4mPqKrNwLaEsVtBjYcFuXdIhGzRoAeWmQnDvKsJlTbCy",
            issuer: "Meridian Identity Corp.",
            predicate: "OFAC_SDN_SCREEN",
            hash: computeMockHash("4mPqKrNwLaEsVtBjYcFuXdIhGzRoAeWmQnDvKsJlTbCy" + "Meridian Identity Corp."),
            prevHash: "e1d2c3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f",
            timestamp: Date.now() - 3600000 * 5,
            rules: ["OFAC_SDN_CLEAR", "PEP_SCREENING_CLEAR"],
            status: "VERIFIED"
        },
        {
            seq: 10840,
            type: "REVOCATION",
            subject: "G2x9nLaKp8sRtVyCdMfYeTh1oA2rPwMiDlFvEqJbFcTs",
            issuer: "Steppe Cryptographic Attesters",
            predicate: "KYC_AML_COMBINED",
            hash: computeMockHash("G2x9nLaKp8sRtVyCdMfYeTh1oA2rPwMiDlFvEqJbFcTs" + "Steppe Cryptographic Attesters"),
            prevHash: "d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b",
            timestamp: Date.now() - 3600000 * 8,
            rules: ["PEP_SCREENING_CLEAR"],
            status: "REVOKED"
        }
    ];
    renderAuditTimeline();
    
    // Draw initial chart
    drawThroughputChart();

    // Start background telemetry & charts animation
    startTelemetryFeed();
    startChartFeed();

    // Init rules in selector list
    updateRuleBuilderView();
}

// ----------------------------------------------------
// Telemetry Updates (Makes page alive)
// ----------------------------------------------------
function startTelemetryFeed() {
    const feed = document.getElementById("event-feed");
    const violations = document.getElementById("violation-feed");
    
    if (telemetryInterval) clearInterval(telemetryInterval);
    
    telemetryInterval = setInterval(() => {
        // Increment statistics values slowly
        statAttestationsVal += Math.floor(Math.random() * 4) + 1;
        statAuditedVal += 0.02;
        if (Math.random() > 0.8) {
            statCapitalVal += Math.floor(Math.random() * 2) + 1;
        }
        
        // Update stats views
        document.getElementById("stat-attestations").innerText = statAttestationsVal.toLocaleString();
        document.getElementById("stat-audited").innerText = statAuditedVal.toFixed(2) + "M";
        document.getElementById("stat-unlocked").innerText = "$" + statCapitalVal + "M";

        // Generate telemetry log item
        const randWallet = generateRandomAddress();
        const randType = Math.random() > 0.88 ? "REVOKE" : "VERIFY";
        const randIssuer = oracleNodes[Math.floor(Math.random() * oracleNodes.length)].name;
        
        const feedItem = document.createElement("div");
        feedItem.className = `feed-item ${randType === 'REVOKE' ? 'REVOKE' : 'VERIFY'}`;
        feedItem.innerHTML = `
            <div class="feed-left">
                <span class="feed-icon">${randType === 'VERIFY' ? '✅' : '🚨'}</span>
                <div>
                    <span class="feed-wallet">${truncateAddress(randWallet, 8, 6)}</span>
                    <div class="feed-issuer">${randIssuer}</div>
                </div>
            </div>
            <div class="feed-right">
                <span class="feed-predicate">CUSTOM_GA_REGISTRY</span>
                <span class="feed-status ${randType === 'VERIFY' ? 'active' : 'revoked'}">
                    ${randType === 'VERIFY' ? 'PASS' : 'REVOKED'}
                </span>
                <span class="feed-time">Just now</span>
            </div>
        `;
        
        feed.prepend(feedItem);
        if (feed.children.length > 8) {
            feed.removeChild(feed.lastChild);
        }

        // Add sanctions violations item
        if (randType === 'REVOKE') {
            const violationItem = document.createElement("div");
            violationItem.className = "violation-item";
            violationItem.innerHTML = `
                <div class="violation-left">
                    <span class="violation-title">⚠️ SANCTIONS BLOCKED</span>
                    <span class="violation-address">${truncateAddress(randWallet, 8, 6)}</span>
                </div>
                <span class="violation-action">GATED</span>
            `;
            violations.prepend(violationItem);
            if (violations.children.length > 5) {
                violations.removeChild(violations.lastChild);
            }
        }
    }, 4500);
}

// ----------------------------------------------------
// Real-time Line Chart Rendering
// ----------------------------------------------------
function drawThroughputChart() {
    const svg = document.getElementById("throughput-chart");
    const linePath = document.getElementById("chart-line-path");
    const areaPath = document.getElementById("chart-area-path");
    if (!svg || !linePath || !areaPath) return;

    const width = 630;  // 680 - 50
    const height = 180; // 200 - 20
    const startX = 50;
    const startY = 20;
    const maxVal = 1200;

    const stepX = width / (chartDataPoints.length - 1);
    
    let pathD = "";
    let areaD = `M ${startX} 200 `; // Start at baseline bottom-left

    chartDataPoints.forEach((point, i) => {
        const x = startX + (i * stepX);
        // Map values to y coordinate (200 is bottom, 20 is top)
        const y = 200 - ((point / maxVal) * height);
        
        if (i === 0) {
            pathD += `M ${x} ${y} `;
        } else {
            pathD += `L ${x} ${y} `;
        }
        areaD += `L ${x} ${y} `;
    });

    areaD += `L ${startX + width} 200 Z`; // Close area path at bottom-right

    linePath.setAttribute("d", pathD);
    areaPath.setAttribute("d", areaD);

    // Re-draw grid/points helper
    // Clear old interactive circles
    const circles = svg.querySelectorAll("circle.chart-dot");
    circles.forEach(c => c.remove());

    // Render new interactive circles
    chartDataPoints.forEach((point, i) => {
        const x = startX + (i * stepX);
        const y = 200 - ((point / maxVal) * height);
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", 4);
        circle.setAttribute("class", "chart-dot");
        circle.setAttribute("fill", "#00f0ff");
        circle.setAttribute("stroke", "#030307");
        circle.setAttribute("stroke-width", "1.5");
        circle.style.cursor = "pointer";
        circle.style.transition = "r 0.2s ease";

        circle.addEventListener("mouseenter", (e) => {
            circle.setAttribute("r", 7);
            showChartTooltip(e.clientX, e.clientY, `Throughput: ${point} tx/slot`);
        });
        circle.addEventListener("mouseleave", () => {
            circle.setAttribute("r", 4);
            hideChartTooltip();
        });

        svg.appendChild(circle);
    });
}

function startChartFeed() {
    if (chartInterval) clearInterval(chartInterval);
    chartInterval = setInterval(() => {
        // Shift values and push a new throughput value
        chartDataPoints.shift();
        const baseVal = 700 + Math.sin(Date.now() / 10000) * 150;
        const newVal = Math.floor(baseVal + Math.random() * 200);
        chartDataPoints.push(newVal);
        drawThroughputChart();
    }, 5000);
}

function showChartTooltip(x, y, text) {
    const tooltip = document.getElementById("chart-tooltip");
    if (!tooltip) return;
    const panel = document.getElementById("chart-panel");
    const rect = panel.getBoundingClientRect();
    
    tooltip.innerText = text;
    tooltip.style.left = `${x - rect.left - 50}px`;
    tooltip.style.top = `${y - rect.top - 40}px`;
    tooltip.style.opacity = 1;
}

function hideChartTooltip() {
    const tooltip = document.getElementById("chart-tooltip");
    if (tooltip) tooltip.style.opacity = 0;
}

// ----------------------------------------------------
// Staking & Oracle Consensus Logic
// ----------------------------------------------------
function renderOracleNodesList() {
    const list = document.getElementById("oracle-node-list");
    if (!list) return;
    list.innerHTML = "";
    oracleNodes.forEach(node => {
        const row = document.createElement("div");
        row.className = "oracle-node-row";
        row.innerHTML = `
            <div class="node-info">
                <span class="node-dot ${node.status === 'ACTIVE' ? '' : 'syncing'}"></span>
                <div>
                    <div class="node-name">${node.name}</div>
                    <div class="node-location">${node.location}</div>
                </div>
            </div>
            <div class="node-metrics">
                <span class="node-stake">💎 ${node.stake.toLocaleString()} SOL</span>
                <span class="node-ping">⚡ ${node.ping}ms</span>
            </div>
        `;
        list.appendChild(row);
    });
}

function populateStakingNodeDropdown() {
    const dropdown = document.getElementById("stake-target-node");
    if (!dropdown) return;
    dropdown.innerHTML = "";
    oracleNodes.forEach(node => {
        const opt = document.createElement("option");
        opt.value = node.id;
        opt.innerText = node.name;
        dropdown.appendChild(opt);
    });
}

// Handle Staking Submission
function delegateStake() {
    playClick();
    const nodeId = document.getElementById("stake-target-node").value;
    const amountVal = parseInt(document.getElementById("stake-amount-sol").value.trim());

    if (isNaN(amountVal) || amountVal <= 0) {
        alert("Please enter a valid amount of SOL to delegate.");
        return;
    }

    const node = oracleNodes.find(n => n.id === nodeId);
    if (node) {
        node.stake += amountVal;
        renderOracleNodesList();
        
        // Update stats Capital Gated: convert stake ratio
        statCapitalVal += Math.floor(amountVal / 100);
        document.getElementById("stat-unlocked").innerText = "$" + statCapitalVal + "M";

        // Log action to Proving Terminal
        const term = document.getElementById("simulator-terminal");
        if (term) {
            const line = document.createElement("div");
            line.className = "term-line warning";
            line.innerText = `[CONSENSUS] Stake Delegation: Successfully delegated ${amountVal.toLocaleString()} SOL to ${node.name}. Stake power recalculated.`;
            term.appendChild(line);
            term.scrollTop = term.scrollHeight;
        }

        document.getElementById("stake-amount-sol").value = "";
    }
}

// ----------------------------------------------------
// Rule Preset & Builder Configurator
// ----------------------------------------------------
function updateRuleBuilderView() {
    const rulesBox = document.getElementById("rules-box");
    if (!rulesBox) return;
    rulesBox.innerHTML = "";

    if (currentRules.length === 0) {
        rulesBox.innerHTML = `<div style="font-size:12px; color:var(--text-muted); font-style:italic;">No active rule checks selected. The attestation will be clear.</div>`;
        return;
    }

    currentRules.forEach((rule, idx) => {
        const item = document.createElement("div");
        item.className = "rule-badge-item";
        item.innerHTML = `
            <span>${rule}</span>
            <button class="remove-rule-btn" onclick="removeRule(${idx})">×</button>
        `;
        rulesBox.appendChild(item);
    });

    // Update Developer code views
    updateCodePreviews();
}

window.removeRule = function(index) {
    playClick();
    currentRules.splice(index, 1);
    updateRuleBuilderView();
};

function addRule() {
    playClick();
    const select = document.getElementById("rule-adder-select");
    const ruleVal = select.value;
    
    if (currentRules.includes(ruleVal)) {
        alert("This rule is already active in the predicate.");
        return;
    }

    currentRules.push(ruleVal);
    updateRuleBuilderView();
}

function updateCodePreviews() {
    // Generate predicate name string based on active rules
    let predicateName = "CUSTOM_GATED_RULE";
    
    // Look if matches presets
    if (currentRules.length === 0) {
        predicateName = "NO_COMPLIANCE_RESTRICTION";
    } else {
        let matchedPreset = false;
        for (const [key, rules] of Object.entries(RULE_PRESETS)) {
            if (rules.length === currentRules.length && rules.every(r => currentRules.includes(r))) {
                predicateName = key;
                matchedPreset = true;
                break;
            }
        }
        if (!matchedPreset) {
            predicateName = "CUSTOM_GATED_" + currentRules.length + "_RULE";
        }
    }

    // Update spans in index.html
    const anchorSpan = document.getElementById("anchor-code-predicate");
    const sdkSpan = document.getElementById("sdk-code-predicate");
    const paySpan = document.getElementById("pay-code-predicate");

    if (anchorSpan) anchorSpan.innerText = predicateName;
    if (sdkSpan) sdkSpan.innerText = predicateName;
    if (paySpan) paySpan.innerText = predicateName;
}

// Handle preset select option triggers
function handlePresetSelect(presetVal) {
    if (RULE_PRESETS[presetVal]) {
        currentRules = [...RULE_PRESETS[presetVal]];
        updateRuleBuilderView();
    }
}

// ----------------------------------------------------
// Prover Simulation Core Logic
// ----------------------------------------------------
function issueOnChainAttestation() {
    playClick();
    const wallet = document.getElementById("sim-wallet").value.trim();
    const issuerId = document.getElementById("sim-issuer").value;
    const isZkp = document.getElementById("sim-zkp-active").checked;

    if (wallet.length < 32) {
        alert("Please enter a valid Solana address (minimum 32 characters).");
        return;
    }

    const term = document.getElementById("simulator-terminal");
    if (!term) return;
    
    term.innerHTML = "";
    isCpiEnabled = false;
    document.getElementById("btn-cpi-verify").disabled = true;

    const logLine = (msg, style = "") => {
        const line = document.createElement("div");
        line.className = `term-line ${style}`;
        line.innerText = msg;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
    };

    let selectedIssuer = "Meridian Identity Corp.";
    if (issuerId === "node-steppe") selectedIssuer = "Steppe Cryptographic Attesters";
    if (issuerId === "node-zurich") selectedIssuer = "Zurich Trust Labs";

    logLine(`[PROVER] Initializing compliance predicate verification for: ${truncateAddress(wallet, 8, 8)}`, "system");

    setTimeout(() => {
        logLine(`[DATABASE] Searching compliance metadata registry databases...`);
    }, 400);

    setTimeout(() => {
        logLine(`[CONSENSUS] Anti-money laundering (AML) check: passed`);
        logLine(`[CONSENSUS] Sanctions registry geofencing check: passed`);
    }, 900);

    setTimeout(() => {
        if (isZkp) {
            logLine(`[PROVER] Witness compilation: satisfied. Building Groth16 circuit.`, "info");
            logLine(`[PROVER] Synthesizing zero-knowledge verification inputs:`);
            if (currentRules.length === 0) {
                logLine(`   - No rules configured. Attesting empty proof state.`, "warning");
            } else {
                currentRules.forEach(rule => {
                    logLine(`   - verify_attribute::[${rule}] -> generated cryptographic leaf witness`);
                });
            }
        }
    }, 1500);

    setTimeout(() => {
        if (isZkp) {
            logLine(`[PROVER] Finished generating ZK Groth16 proof parameters. Circuits constraint count: 48,290.`, "success");
            logLine(`[PROVER] Proof signature output: 0xaa27e9...${Math.floor(Math.random() * 900000 + 100000).toString(16)}`, "success");
        }
    }, 2200);

    setTimeout(() => {
        logLine(`[LEDGER] Building Anchor issue_attestation transaction instructions...`);
        const pdaAddress = generateRandomAddress();
        logLine(`[LEDGER] Deriving Attestation PDA: ${pdaAddress}`, "info");
        logLine(`   - Seed values: ['solaudit_credential', wallet_key, rules_hash]`);
    }, 2900);

    setTimeout(() => {
        const txHash = computeMockHash(wallet + Date.now().toString());
        const seqNum = auditBlocks.length > 0 ? auditBlocks[0].seq + 1 : 10001;

        currentAttestationData = {
            seq: seqNum,
            type: "ISSUANCE",
            subject: wallet,
            issuer: selectedIssuer,
            predicate: currentRules.length > 0 ? "CUSTOM_GATED_RULE" : "CLEAR_ATTTESTATION",
            hash: txHash,
            prevHash: auditBlocks.length > 0 ? auditBlocks[0].hash : "0x00000000000000000000",
            timestamp: Date.now(),
            rules: [...currentRules],
            status: "VERIFIED"
        };

        // Prepend and rebuild timeline
        auditBlocks.unshift(currentAttestationData);
        renderAuditTimeline();

        logLine(`[SUCCESS] Attestation PDA registered on-chain successfully!`, "success");
        logLine(`[SUCCESS] Block slot: 182,493,124 | Tx: ${txHash}`, "success");

        isCpiEnabled = true;
        document.getElementById("btn-cpi-verify").disabled = false;
    }, 3600);
}

function verifyCPIAttestation() {
    if (!isCpiEnabled || !currentAttestationData) return;
    playClick();

    const term = document.getElementById("simulator-terminal");
    if (!term) return;

    const logLine = (msg, style = "") => {
        const line = document.createElement("div");
        line.className = `term-line ${style}`;
        line.innerText = msg;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
    };

    logLine(`\n[CPI-GATE] Gated DEX contract executing atomic trade action...`, "system");

    setTimeout(() => {
        logLine(`[CPI-GATE] DEX executing Cross-Program Invocation to verify_attestation program...`);
        logLine(`[CPI-GATE] Reading on-chain PDA account state details...`);
    }, 500);

    setTimeout(() => {
        logLine(`[CPI-GATE] Proof verification status: ACTIVE`);
        logLine(`[CPI-GATE] Validating cryptographic signatures against oracle keys...`);
    }, 1100);

    setTimeout(() => {
        logLine(`[CPI-GATE] Result: VERIFIED. compliance predicate passed dynamically.`, "success");
        logLine(`[CPI-GATE] DEX contract executing swap: instruction cleared.`, "success");
    }, 1700);
}

// ----------------------------------------------------
// Merkle Timeline & Proof Visualizer
// ----------------------------------------------------
function renderAuditTimeline() {
    const container = document.getElementById("chain-timeline");
    if (!container) return;
    container.innerHTML = "";

    auditBlocks.forEach(block => {
        const item = document.createElement("div");
        item.className = "chain-block";
        item.dataset.seq = block.seq;
        
        if (currentAttestationData && currentAttestationData.seq === block.seq) {
            item.classList.add("active");
        }

        item.innerHTML = `
            <div class="block-header">
                <span class="block-num">EVENT ACCOUNT PDA [Seq: ${block.seq}]</span>
                <span class="block-ts">${new Date(block.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="block-desc">${block.type} -> ${truncateAddress(block.subject, 8, 8)}</div>
            <div class="block-hash">Hash: ${block.hash}</div>
        `;

        item.addEventListener("click", () => {
            playClick();
            document.querySelectorAll(".chain-block").forEach(b => b.classList.remove("active"));
            item.classList.add("active");
            showBlockMerkleProof(block);
        });

        container.appendChild(item);
    });

    // Auto-select first item on load
    if (auditBlocks.length > 0) {
        showBlockMerkleProof(auditBlocks[0]);
    }
}

function showBlockMerkleProof(block) {
    const container = document.getElementById("block-details-content");
    if (!container) return;

    const blockHashShort = truncateAddress(block.hash, 8, 6);
    const parentHash = computeMockHash(block.hash + block.prevHash);
    const parentHashShort = truncateAddress(parentHash, 8, 6);
    const rootHash = computeMockHash(parentHash + "solana-root-seal-key");
    const rootHashShort = truncateAddress(rootHash, 8, 6);

    container.innerHTML = `
        <div class="details-wrapper">
            <div class="merkle-proof-visualizer">
                <h4>Dynamic Merkle Proof Verification</h4>
                <div class="merkle-tree-flow">
                    <!-- Tree Root -->
                    <div class="tree-level">
                        <div class="tree-node-circle verified">
                            <span class="tree-node-label">Merkle Root Seal</span>
                            <span class="tree-node-value">${rootHashShort}</span>
                        </div>
                    </div>
                    
                    <!-- SVG lines drawing -->
                    <svg class="merkle-svg-connectors" viewBox="0 0 450 160">
                        <path class="merkle-line highlight" d="M 225 35 L 112 110" />
                        <path class="merkle-line" d="M 225 35 L 337 110" />
                    </svg>

                    <!-- Subtree node children -->
                    <div class="tree-level" style="margin-top: 15px;">
                        <div class="tree-node-circle active">
                            <span class="tree-node-label">Subtree hash (L)</span>
                            <span class="tree-node-value">${parentHashShort}</span>
                        </div>
                        <div class="tree-node-circle" style="opacity: 0.55;">
                            <span class="tree-node-label">Sibling hash (R)</span>
                            <span class="tree-node-value">ab12d9...ffee</span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- PDA Fields Display -->
            <div class="pda-data-grid">
                <div class="pda-field">
                    <span class="pda-field-label">Subject (Wallet Address)</span>
                    <div class="pda-field-value">${truncateAddress(block.subject, 8, 8)}</div>
                </div>
                <div class="pda-field">
                    <span class="pda-field-label">Accredited Node Issuer</span>
                    <div class="pda-field-value">${block.issuer}</div>
                </div>
                <div class="pda-field">
                    <span class="pda-field-label">Linked Block Slot</span>
                    <div class="pda-field-value">Slot #182,49${block.seq}</div>
                </div>
                <div class="pda-field">
                    <span class="pda-field-label">Attributes Verified</span>
                    <div class="pda-field-value" style="font-size:10px; color: var(--neon-cyan);">
                        ${block.rules.length > 0 ? block.rules.join(", ") : "None (Clear)"}
                    </div>
                </div>
            </div>

            <div class="cpi-tester" style="padding: 12px 18px;">
                <h4 style="margin: 0; font-size: 13px; color: var(--color-green);">
                    ✅ Cryptographic compliance proof matches anchoring slot. Verification cleared.
                </h4>
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// DAO Governance Life Cycle
// ----------------------------------------------------
function renderProposalsList() {
    const list = document.getElementById("gov-proposals");
    if (!list) return;
    list.innerHTML = "";

    governanceProposals.forEach(prop => {
        const totalVotes = prop.votesYes + prop.votesNo;
        const yesPercent = totalVotes > 0 ? (prop.votesYes / totalVotes) * 100 : 50;

        const row = document.createElement("div");
        row.className = "proposal-row";
        row.innerHTML = `
            <div class="proposal-meta">
                <span class="prop-badge ${prop.status.toLowerCase()}">${prop.status}</span>
                <span class="proposal-votes">👍 ${prop.votesYes.toLocaleString()} Yes | 👎 ${prop.votesNo.toLocaleString()} No</span>
            </div>
            <div class="proposal-title">${prop.id}: ${prop.title}</div>
            
            <div class="vote-progress-container">
                <div class="vote-progress-bar" style="width: ${yesPercent}%"></div>
            </div>

            ${prop.status === "ACTIVE" ? `
                <div class="proposal-actions">
                    <button class="btn-vote yes" onclick="voteOnProposal('${prop.id}', 'yes')">VOTE YES</button>
                    <button class="btn-vote no" onclick="voteOnProposal('${prop.id}', 'no')">VOTE NO</button>
                </div>
            ` : ''}
        `;
        list.appendChild(row);
    });
}

window.voteOnProposal = function(propId, side) {
    playClick();
    const prop = governanceProposals.find(p => p.id === propId);
    if (!prop || prop.status !== "ACTIVE") return;

    if (side === "yes") {
        prop.votesYes += Math.floor(Math.random() * 8000) + 4000;
    } else {
        prop.votesNo += Math.floor(Math.random() * 5000) + 2000;
    }

    // Check if votes exceed threshold of 180,000 Yes to pass proposal
    if (prop.votesYes >= 180000) {
        prop.status = "PASSED";
        
        // Log to proving terminal
        const term = document.getElementById("simulator-terminal");
        if (term) {
            const line = document.createElement("div");
            line.className = "term-line success";
            line.innerText = `[GOVERNANCE] Proposal ${prop.id} has PASSED threshold consensus state and has been committed to the compliance register.`;
            term.appendChild(line);
        }
    }

    renderProposalsList();
};

function submitNewProposal() {
    playClick();
    const titleInput = document.getElementById("prop-title");
    const typeSelect = document.getElementById("prop-type");
    const titleVal = titleInput.value.trim();
    const typeVal = typeSelect.value;

    if (!titleVal) {
        alert("Please enter a title description for the proposal.");
        return;
    }

    const nextIdNum = governanceProposals.length + 4;
    const propId = `SAP-0${nextIdNum}`;

    const newProp = {
        id: propId,
        title: titleVal,
        type: typeVal,
        votesYes: 15000,
        votesNo: 2000,
        status: "ACTIVE"
    };

    governanceProposals.push(newProp);
    titleInput.value = "";
    renderProposalsList();

    // Log action to Proving Terminal
    const term = document.getElementById("simulator-terminal");
    if (term) {
        const line = document.createElement("div");
        line.className = "term-line warning";
        line.innerText = `[GOVERNANCE] Active Proposal ${propId} submitted. Initiating validator validation voting phase.`;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
    }

    // Simulate other validators voting over time
    let voteCycles = 0;
    const simVotes = setInterval(() => {
        if (newProp.status !== "ACTIVE" || voteCycles >= 10) {
            clearInterval(simVotes);
            return;
        }
        newProp.votesYes += Math.floor(Math.random() * 25000) + 12000;
        newProp.votesNo += Math.floor(Math.random() * 8000) + 3000;
        
        if (newProp.votesYes >= 180000) {
            newProp.status = "PASSED";
            clearInterval(simVotes);
            
            if (term) {
                const line = document.createElement("div");
                line.className = "term-line success";
                line.innerText = `[GOVERNANCE] Proposal ${propId} has reached quorum and PASSED. Rules updated on slot register.`;
                term.appendChild(line);
                term.scrollTop = term.scrollHeight;
            }
        }
        renderProposalsList();
        voteCycles++;
    }, 2000);
}

// ----------------------------------------------------
// Simulated Wallet Connection Modal Flow
// ----------------------------------------------------
function openWalletModal() {
    playClick();
    document.getElementById("wallet-modal-overlay").classList.add("open");
}

function closeWalletModal() {
    playClick();
    document.getElementById("wallet-modal-overlay").classList.remove("open");
}

function selectWalletOption(walletName) {
    playClick();
    closeWalletModal();

    // Generate random mock address for connection
    connectedWallet = generateRandomAddress();
    
    // Update navbar button state
    const connectBtn = document.getElementById("btn-connect-wallet");
    connectBtn.innerText = truncateAddress(connectedWallet, 5, 4);
    connectBtn.className = "btn btn-wallet-connected";

    // Set simulator input field target to this connected address
    document.getElementById("sim-wallet").value = connectedWallet;

    // Log to Proving Terminal
    const term = document.getElementById("simulator-terminal");
    if (term) {
        const line = document.createElement("div");
        line.className = "term-line success";
        line.innerText = `[WALLET] Connected successfully via simulated ${walletName.toUpperCase()} wallet provider client.`;
        term.appendChild(line);
        term.scrollTop = term.scrollHeight;
    }
}

// ----------------------------------------------------
// Developer Copy and Tab switching logic
// ----------------------------------------------------
function copyActiveCodeSnippet() {
    playClick();
    const activeTab = document.querySelector(".tab-content.active");
    if (!activeTab) return;

    const codeText = activeTab.innerText;
    navigator.clipboard.writeText(codeText).then(() => {
        const btn = document.getElementById("btn-copy-code");
        const originalText = btn.querySelector("span").innerText;
        btn.querySelector("span").innerText = "Copied!";
        setTimeout(() => {
            btn.querySelector("span").innerText = originalText;
        }, 2000);
    }).catch(err => {
        alert("Failed to copy code to clipboard: " + err);
    });
}

// ----------------------------------------------------
// Event Listeners Registration
// ----------------------------------------------------
function bindEvents() {
    // Wallet Connection button
    document.getElementById("btn-connect-wallet").addEventListener("click", () => {
        if (connectedWallet) {
            // Disconnect wallet
            connectedWallet = null;
            const connectBtn = document.getElementById("btn-connect-wallet");
            connectBtn.innerText = "Connect Wallet";
            connectBtn.className = "btn btn-primary";
            
            // Log to terminal
            const term = document.getElementById("simulator-terminal");
            if (term) {
                const line = document.createElement("div");
                line.className = "term-line system";
                line.innerText = `[WALLET] Disconnected from wallet provider client session.`;
                term.appendChild(line);
            }
        } else {
            openWalletModal();
        }
    });

    // Close Wallet Modal
    document.getElementById("btn-close-wallet-modal").addEventListener("click", closeWalletModal);

    // Click wallet options
    document.querySelectorAll(".wallet-option").forEach(opt => {
        opt.addEventListener("click", () => {
            selectWalletOption(opt.dataset.wallet);
        });
    });

    // Random address button
    document.getElementById("btn-rand-wallet").addEventListener("click", () => {
        playClick();
        document.getElementById("sim-wallet").value = generateRandomAddress();
    });

    // Custom Rule builder Add Rule button
    document.getElementById("btn-add-rule").addEventListener("click", addRule);

    // Issue Attestation Action Button
    document.getElementById("btn-issue").addEventListener("click", issueOnChainAttestation);

    // CPI verify instruction trigger
    document.getElementById("btn-cpi-verify").addEventListener("click", verifyCPIAttestation);

    // Delegate SOL stake submit
    document.getElementById("btn-delegate-stake").addEventListener("click", delegateStake);

    // Submit Governance proposal
    document.getElementById("btn-submit-proposal").addEventListener("click", submitNewProposal);

    // tab selectors
    document.querySelectorAll(".tab-btn").forEach(tab => {
        tab.addEventListener("click", () => {
            playClick();
            document.querySelectorAll(".tab-btn").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

            tab.classList.add("active");
            const targetId = `tab-${tab.dataset.tab}`;
            document.getElementById(targetId).classList.add("active");
        });
    });

    // Copy code snippet helper
    document.getElementById("btn-copy-code").addEventListener("click", copyActiveCodeSnippet);

    // Input presets options change update
    const predicateSelect = document.getElementById("rule-adder-select");
    // Connect sandbox predicate drop triggers if required
}

// DOM content load handler
window.addEventListener("DOMContentLoaded", () => {
    initDashboard();
    bindEvents();
});
