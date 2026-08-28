// ==========================================
// 1. SESSION MANAGEMENT & PROFILE HELPER
// ==========================================
function getCurrentUserProfile() {
    let activeUser = window.currentUser;

    if (!activeUser) {
        const sessionData = localStorage.getItem('portal_session');
        if (sessionData) {
            try {
                activeUser = JSON.parse(sessionData);
            } catch (e) {
                console.error("Error parsing portal_session from localStorage:", e);
                activeUser = null;
            }
        }
    }

    // Fallback if no active session is found
    return activeUser || {
        username: "Guest Student",
        role: "Student",
        institution: "Standard College Ntungamo"
    };
}

// ==========================================
// 2. DOM ELEMENT REFERENCES
// ==========================================
const challengeSelect = document.getElementById("challengeSelect");
const challengePrompt = document.getElementById("challengePrompt");
const challengeHint = document.getElementById("challengeHint");
const studentAnswer = document.getElementById("studentAnswer");
const verifyBtn = document.getElementById("verifyBtn");
const feedbackOutput = document.getElementById("feedbackOutput");

// State variables for question sequencing
let currentQuestionsList = [];
let currentIndex = 0;
let isAnswerCorrect = false;

// ==========================================
// 3. WORLD-CLASS EXCEL & ACCESS PARSER & VERIFIER ENGINE
// ==========================================
function excelColToNum(colStr) {
    let num = 0;
    const upper = colStr.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
        num = num * 26 + (upper.charCodeAt(i) - 64);
    }
    return num;
}

function isValidCellCoordinate(cellStr) {
    const match = cellStr.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return false;

    const colLetters = match[1];
    const rowNum = parseInt(match[2], 10);
    const colNum = excelColToNum(colLetters);
    
    const MAX_COL = 16384; // XFD
    const MAX_ROW = 1048576;

    return colNum >= 1 && colNum <= MAX_COL && rowNum >= 1 && rowNum <= MAX_ROW;
}

// [Upgrade 1 & 2]: Lightweight Tokenizer and Safe Comma-Splitter respecting quotes & nested parentheses
function tokenizeFormula(formulaStr) {
    let tokens = [];
    let current = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < formulaStr.length; i++) {
        let char = formulaStr[i];
        
        if ((char === '"' || char === "'") && (i === 0 || formulaStr[i - 1] !== '\\')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (stringChar === char) {
                inString = false;
            }
        }

        if (!inString && /\s/.test(char)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }
    if (current) tokens.push(current);
    return tokens;
}

function splitExcelArguments(argStr) {
    let args = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < argStr.length; i++) {
        let char = argStr[i];
        
        if ((char === '"' || char === "'") && (i === 0 || argStr[i - 1] !== '\\')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (stringChar === char) {
                inString = false;
            }
        }

        if (!inString) {
            if (char === '(') depth++;
            if (char === ')') depth--;
            if (char === ',' && depth === 0) {
                args.push(current.trim());
                current = '';
                continue;
            }
        }
        current += char;
    }
    if (current) args.push(current.trim());
    return args;
}

function isValidExcelValueToken(token) {
    const clean = token.trim();
    if (!clean) return false;
    if (!isNaN(Number(clean))) return true;
    const rawCell = clean.replace(/\$/g, '').split('!').pop();
    if (isValidCellCoordinate(rawCell)) return true;
    if ((clean.startsWith('"') && clean.endsWith('"')) || (clean.startsWith("'") && clean.endsWith("'"))) return true;
    if (/^(=?\s*[A-Z]+\s*\(.*\))$/i.test(clean)) return true;
    if (['TRUE', 'FALSE'].includes(clean.toUpperCase())) return true;
    return false;
}

function validateStudentAnswer(question, inputStr) {
    let cleanInput = inputStr.trim();
    const rule = question.ruleType; 
    const expected = question.expectedValue ? question.expectedValue.trim() : ""; 

    if (!cleanInput) {
        return { correct: false, message: "Please enter an expression before verifying." };
    }

    // [Upgrade 3]: Proactive Regional & Syntax Check for Missing Equals Sign or Semicolons
    if (!cleanInput.startsWith("=") && rule.startsWith("EXCEL_")) {
        return { 
            correct: false, 
            message: `#NAME? Error: Did you forget to start your formula with an equals sign (=)? Excel formulas must begin with =.` 
        };
    }

    if (cleanInput.includes(";") && !cleanInput.includes(",")) {
        return { 
            correct: false, 
            message: `#VALUE! Error: It looks like you used semicolons (;) instead of commas (,). Check your regional argument separator settings.` 
        };
    }

    const upperInput = cleanInput.toUpperCase();

    switch (rule) {
        // --- 1. BASIC AGGREGATIONS (SUM, AVERAGE) ---
        case "EXCEL_SUM":
        case "EXCEL_AVERAGE": {
            const func = rule === "EXCEL_SUM" ? "SUM" : "AVERAGE";
            const pattern = new RegExp(`^=\\s*${func}\\s*\\(\\s*(.+?)\\s*\\)$`, 'i');
            const match = cleanInput.match(pattern);

            if (!match) {
                return { correct: false, message: `#NAME? Error: Excel expects proper function syntax like =${func}(range).` };
            }

            const inner = match[1].replace(/\s+/g, '');
            let isWithinBounds = false;

            if (inner.includes(':')) {
                const parts = inner.split(':');
                if (parts.length === 2) {
                    const startCell = parts[0].replace(/\$/g, '');
                    const endCell = parts[1].replace(/\$/g, '');
                    
                    if (isValidCellCoordinate(startCell) && isValidCellCoordinate(endCell)) {
                        isWithinBounds = (inner === expected.replace(/\s+/g, '').toUpperCase()) || 
                                         (inner.includes(expected.replace(/\s+/g, '').toUpperCase()));
                    }
                }
            } else {
                const cells = inner.split(',');
                if (cells.length > 0 && cells.every(c => isValidCellCoordinate(c.replace(/\$/g, '')))) {
                    isWithinBounds = upperInput.includes(expected.toUpperCase());
                }
            }

            return {
                correct: isWithinBounds,
                message: isWithinBounds 
                    ? `Correct! "${cleanInput}" successfully evaluates within Excel grid limits (Max: XFD1048576).` 
                    : `#REF! Error: Check your range boundaries or ensure coordinates do not exceed Excel limits.`
            };
        }

        // --- 2 & 4. CONDITIONAL CHECK (IF) WITH DEEP AST ARGUMENT & ERROR DIAGNOSTICS ---
        case "EXCEL_IF": {
            const ifPattern = /^=\s*IF\s*\(\s*(.+)\s*\)$/i;
            const match = cleanInput.match(ifPattern);

            if (!match) {
                return { 
                    correct: false, 
                    message: `#NAME? Error: Ensure your formula starts with =IF( and closes with matching parentheses.` 
                };
            }

            const args = splitExcelArguments(match[1]);
            
            // Diagnostic Hinting for argument count mismatches
            if (args.length < 3) {
                return { 
                    correct: false, 
                    message: `#VALUE! Error: Your IF function has only ${args.length} argument(s). Excel requires 3 arguments: logical_test, value_if_true, and value_if_false.` 
                };
            }
            if (args.length > 3) {
                return { 
                    correct: false, 
                    message: `#VALUE! Error: Your IF function has too many arguments (${args.length}). Excel requires exactly 3 arguments separated by commas.` 
                };
            }

            const logicalTest = args[0];
            const valueIfTrue = args[1];
            const valueIfFalse = args[2];

            const expectedNormalized = expected.replace(/\s+/g, '').toUpperCase();
            const logicalNormalized = logicalTest.replace(/\s+/g, '').toUpperCase();
            const isLogicalValid = logicalNormalized.includes(expectedNormalized);

            if (!isLogicalValid) {
                return { 
                    correct: false, 
                    message: `#VALUE! Error in logical condition. Expected core criteria component missing: ${expected}.` 
                };
            }

            if (!isValidExcelValueToken(valueIfTrue) || !isValidExcelValueToken(valueIfFalse)) {
                return { 
                    correct: false, 
                    message: `#NAME? Error: Text arguments in Excel must be explicitly enclosed in double quotation marks (e.g., "Overtime").` 
                };
            }

            return {
                correct: true,
                message: `Correct! "${cleanInput}" properly satisfies Excel's IF function argument structure and data typing rules.`
            };
        }

        // --- 3. LOOKUP FUNCTIONS (VLOOKUP, HLOOKUP, LOOKUP) ---
        case "EXCEL_VLOOKUP":
        case "EXCEL_HLOOKUP":
        case "EXCEL_LOOKUP": {
            const func = rule.replace('EXCEL_', '');
            const properSyntax = upperInput.startsWith(`=${func}(`) && upperInput.endsWith(')');
            
            if (!properSyntax) {
                return { correct: false, message: `#NAME? Error: Verify your function prefix and closing parenthesis for =${func}().` };
            }

            const innerMatch = cleanInput.match(new RegExp(`^=\\s*${func}\\s*\\(\\s*(.+)\\s*\\)$`, 'i'));
            if (innerMatch) {
                const args = splitExcelArguments(innerMatch[1]);
                if (func === 'VLOOKUP' && args.length < 3) {
                    return { correct: false, message: `#VALUE! Error: =VLOOKUP requires at least lookup_value, table_array, and col_index_num.` };
                }
            }

            const correct = upperInput.includes(expected.toUpperCase());
            return {
                correct,
                message: correct 
                    ? `Correct! "${cleanInput}" matches required ${func} layout criteria.` 
                    : `#N/A Error: Verify your lookup parameters, table array, and reference syntax for =${func}().`
            };
        }

        // --- 4. CONDITIONAL AGGREGATIONS (SUMIF, COUNTIF, AVERAGEIF) ---
        case "EXCEL_SUMIF":
        case "EXCEL_COUNTIF":
        case "EXCEL_AVERAGEIF": {
            const func = rule.replace('EXCEL_', '');
            const properSyntax = upperInput.startsWith(`=${func}(`) && upperInput.endsWith(')');
            const correct = properSyntax && upperInput.includes(expected.toUpperCase());

            return {
                correct,
                message: correct 
                    ? `Correct! "${cleanInput}" accurately built the ${func} condition structure.` 
                    : `#VALUE! Error: Check your range, criteria expression, and parameter types for =${func}().`
            };
        }

        // --- 5. RANK FUNCTION ---
        case "EXCEL_RANK": {
            const properSyntax = upperInput.startsWith('=RANK(') && upperInput.endsWith(')');
            const correct = properSyntax && upperInput.includes(expected.toUpperCase());

            return {
                correct,
                message: correct 
                    ? `Correct! "${cleanInput}" successfully computed the rank configuration.` 
                    : `#VALUE! Error: Syntax format mismatch. Expected structure: =RANK(number, ref, [order]).`
            };
        }

        // --- 6. ACCESS QUERY CRITERIA & WILDCARDS ---
        case "ACCESS_CRITERIA": {
            const normalized = upperInput.replace(/^LIKE\s+/i, '').replace(/["']/g, '');
            const correct = normalized === expected.toUpperCase() || upperInput.includes(expected.toUpperCase());
            return {
                correct,
                message: correct 
                    ? `Correct! "${cleanInput}" matches Access design criteria formatting.` 
                    : `Invalid Criteria Error: Review your field parameters, operators, or wildcard characters.`
            };
        }

        // --- 5 [Upgrade 5]: FLEXIBLE ACCESS QUERY NORMALIZATION ---
        case "ACCESS_CALCULATED": {
            // Strip all spaces and normalize square brackets to prevent syntax pedantry penalizing students
            const normalizedStudent = upperInput.replace(/\s+/g, '').replace(/\[/g, '').replace(/\]/g, '');
            const normalizedExpected = expected.toUpperCase().replace(/\s+/g, '').replace(/\[/g, '').replace(/\]/g, '');

            const hasColon = upperInput.includes(':');
            const correct = hasColon && normalizedStudent.includes(normalizedExpected);

            return {
                correct,
                message: correct 
                    ? `Correct! "${cleanInput}" successfully defined the calculated query expression.` 
                    : `Syntax Error: Ensure you use a field alias followed by a colon and square bracket expressions (e.g., Total: [Price]*[Qty]).`
            };
        }

        default: {
            const correct = upperInput.includes(expected.toUpperCase());
            return { 
                correct, 
                message: correct ? `Correct! "${cleanInput}" verified successfully.` : `Incorrect ("${cleanInput}"). Please check your entry.` 
            };
        }
    }
}

// ==========================================
// 4. DYNAMIC QUESTION FETCHING FROM FIRESTORE
// ==========================================
async function loadChallengesFromFirestore() {
    const selectedCategory = challengeSelect.value; 
    currentQuestionsList = [];
    currentIndex = 0;
    
    challengePrompt.textContent = "Loading challenges from the database...";
    challengeHint.textContent = "";
    studentAnswer.value = "";
    verifyBtn.textContent = "Verify Answer";
    verifyBtn.style.display = "block";
    studentAnswer.style.display = "block";

    if (typeof db === 'undefined') {
        challengePrompt.textContent = "Database connection not found.";
        return;
    }

    try {
        const snapshot = await db.collection("challenges")
            .where("category", "==", selectedCategory)
            .get();

        if (snapshot.empty) {
            challengePrompt.textContent = "No challenges found for this category in the database yet.";
            challengeHint.textContent = "Ask an administrator/teacher to add questions for this section.";
            studentAnswer.style.display = "none";
            verifyBtn.style.display = "none";
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            currentQuestionsList.push({
                id: doc.id,
                type: data.type || "EXCEL",
                prompt: data.prompt,
                hint: data.hint || "",
                ruleType: data.ruleType || "DEFAULT",
                expectedValue: data.expectedValue || ""
            });
        });

        displayCurrentQuestion();
    } catch (error) {
        console.error("Error fetching challenges: ", error);
        challengePrompt.textContent = "Error loading challenges from server.";
    }
}

function displayCurrentQuestion() {
    if (currentQuestionsList.length === 0) return;

    if (currentIndex >= currentQuestionsList.length) {
        challengePrompt.textContent = "🎉 Congratulations! You have completed all questions in this category set.";
        challengeHint.textContent = "";
        studentAnswer.style.display = "none";
        verifyBtn.style.display = "none";
        feedbackOutput.className = "feedback-correct";
        feedbackOutput.textContent = "Session complete. Great work!";
        return;
    }

    studentAnswer.style.display = "block";
    verifyBtn.style.display = "block";
    
    const current = currentQuestionsList[currentIndex];
    challengePrompt.textContent = `Question ${currentIndex + 1} of ${currentQuestionsList.length}: ${current.prompt}`;
    challengeHint.textContent = "Hint: " + current.hint;
    studentAnswer.value = "";
    isAnswerCorrect = false;
    
    verifyBtn.textContent = "Verify Answer";
    verifyBtn.className = "primary-btn";
    
    feedbackOutput.className = "feedback-placeholder";
    feedbackOutput.textContent = "Submit an answer to see real-time verification and grading.";
}

// ==========================================
// 5. VERIFICATION & PROGRESSION EVENT HANDLER
// ==========================================
challengeSelect.addEventListener("change", loadChallengesFromFirestore);

verifyBtn.addEventListener("click", async () => {
    const current = currentQuestionsList[currentIndex];

    // If already answered correctly, clicking advances to the next question in sequence
    if (isAnswerCorrect) {
        currentIndex++;
        displayCurrentQuestion();
        return;
    }

    const val = studentAnswer.value;
    if (!val.trim()) {
        feedbackOutput.className = "feedback-incorrect";
        feedbackOutput.textContent = "Please enter an expression before verifying.";
        return;
    }

    let result;
    try {
        result = validateStudentAnswer(current, val);
    } catch (err) {
        console.error("Validation execution error:", err);
        result = { correct: false, message: "Syntax execution issue while validating formula." };
    }

    if (result.correct) {
        isAnswerCorrect = true;
        feedbackOutput.className = "feedback-correct";
        feedbackOutput.textContent = "✔ " + result.message;
        
        // Switch button to Next action style
        verifyBtn.textContent = currentIndex < currentQuestionsList.length - 1 ? "Next Question →" : "Finish Set 🎉";
        verifyBtn.className = "primary-btn next-action-btn";
    } else {
        feedbackOutput.className = "feedback-incorrect";
        feedbackOutput.textContent = "✘ " + result.message;
    }

    // Log the user submission attempt to Firestore
    const activeUser = getCurrentUserProfile();
    if (typeof db !== 'undefined') {
        try {
            await db.collection("formulaSubmissions").add({
                challengeId: current.id,
                challengeType: current.type,
                submission: val,
                isCorrect: result.correct,
                feedbackMessage: result.message,
                user: activeUser.username || activeUser.name || "Unknown",
                role: activeUser.role || "Student",
                institution: activeUser.institution || "Standard College Ntungamo",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error("Error saving submission to Firestore: ", error);
        }
    }
});

// Hamburger Mobile Menu Toggle
const hamburgerBtn = document.getElementById('hamburgerBtn');
const navRight = document.getElementById('navRight');

if (hamburgerBtn && navRight) {
    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navRight.classList.toggle('mobile-active');
    });

    // Close mobile menu when clicking outside
    window.addEventListener('click', () => {
        if (navRight.classList.contains('mobile-active')) {
            navRight.classList.remove('mobile-active');
        }
    });
}

// ==========================================
// 6. ADMIN / TEACHER BULK IMPORT MODULE
// ==========================================
function setupAdminImportModule() {
    const activeUser = getCurrentUserProfile();
    const userRole = (activeUser.role || "").toLowerCase();
    
    // Check if user has administrative or teacher privileges
    const isAdminOrTeacher = userRole.includes("admin") || userRole.includes("teacher") || userRole.includes("educator");

    // Create container for admin tools if it doesn't exist
    let adminContainer = document.getElementById("adminImportSection");
    if (!adminContainer) {
        adminContainer = document.createElement("div");
        adminContainer.id = "adminImportSection";
        adminContainer.className = "admin-panel";
        adminContainer.style.margin = "20px 0";
        adminContainer.style.padding = "15px";
        adminContainer.style.border = "2px dashed #007bff";
        adminContainer.style.borderRadius = "8px";
        adminContainer.style.background = "#f8f9fa";
        
        adminContainer.innerHTML = `
            <h3>🔒 Admin / Teacher: Bulk Import Questions</h3>
            <p style="font-size: 0.9em; color: #555;">Paste JSON data containing an array of lightweight rules to batch upload to Firestore.</p>
            <label for="importCategory"><strong>Target Category Key:</strong></label><br>
            <input type="text" id="importCategory" value="excel_if" style="width: 100%; padding: 6px; margin-bottom: 10px;" /><br>
            <label for="jsonInput"><strong>Questions JSON Data:</strong></label><br>
            <textarea id="jsonInput" rows="6" style="width: 100%; font-family: monospace;" placeholder='[{"type":"EXCEL", "prompt":"...", "hint":"...", "ruleType":"EXCEL_SUM", "expectedValue":"R$2:R$50"}]'></textarea><br>
            <button id="uploadBatchBtn" class="primary-btn" style="margin-top: 10px; background: #28a745;">Upload Questions to Firebase</button>
            <div id="uploadFeedback" style="margin-top: 8px; font-weight: bold;"></div>
        `;
        
        // Insert module right above the workspace section
        const workspace = document.querySelector(".workspace");
        if (workspace) {
            workspace.parentNode.insertBefore(adminContainer, workspace);
        }
    }

    // Toggle visibility based on credentials check
    if (isAdminOrTeacher) {
        adminContainer.style.display = "block";
        
        document.getElementById("uploadBatchBtn").addEventListener("click", async () => {
            const targetCategoryInput = document.getElementById("importCategory");
            const jsonInputBox = document.getElementById("jsonInput");
            const targetCategory = targetCategoryInput.value.trim();
            const rawJson = jsonInputBox.value.trim();
            const feedbackDiv = document.getElementById("uploadFeedback");

            if (!targetCategory || !rawJson) {
                feedbackDiv.style.color = "red";
                feedbackDiv.textContent = "Please provide both a target category and JSON payload.";
                return;
            }

            try {
                const questionsArray = JSON.parse(rawJson);
                if (!Array.isArray(questionsArray)) {
                    throw new Error("JSON root must be an array of objects.");
                }

                feedbackDiv.style.color = "blue";
                feedbackDiv.textContent = `Uploading ${questionsArray.length} questions...`;

                const batch = db.batch();
                questionsArray.forEach(q => {
                    const docRef = db.collection("challenges").doc();
                    batch.set(docRef, {
                        category: targetCategory,
                        type: q.type || "EXCEL",
                        prompt: q.prompt,
                        hint: q.hint || "",
                        ruleType: q.ruleType || "DEFAULT",
                        expectedValue: q.expectedValue || "",
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                });

                await batch.commit();
                feedbackDiv.style.color = "green";
                feedbackDiv.textContent = "✔ Successfully imported all questions into Firestore! Clearing fields & refreshing list...";
                
                // Clear out the form fields after successful import
                jsonInputBox.value = "";
                targetCategoryInput.value = "";

                // Refresh client dropdown view
                setTimeout(() => {
                    loadChallengesFromFirestore();
                }, 1500);

            } catch (err) {
                console.error("Batch import error:", err);
                feedbackDiv.style.color = "red";
                feedbackDiv.textContent = "Error parsing or uploading JSON: " + err.message;
            }
        });
    } else {
        adminContainer.style.display = "none"; // Hide panel entirely from regular students
    }
}

// ==========================================
// 7. INITIALIZATION ON PAGE LOAD
// ==========================================
loadChallengesFromFirestore();
setupAdminImportModule();
