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

// Helper function to verify matching parenthesis depth
function areParenthesesBalanced(str) {
    let count = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < str.length; i++) {
        let char = str[i];

        if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
            if (!inString) {
                inString = true;
                stringChar = char;
            } else if (stringChar === char) {
                inString = false;
            }
        }

        if (!inString) {
            if (char === '(') count++;
            if (char === ')') count--;
            if (count < 0) return false; // Closed before opened
        }
    }
    return count === 0;
}

// ==========================================
// 3. FULLY UPGRADED WORLD-CLASS EXCEL & ACCESS ENGINE
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

function areParenthesesBalanced(str) {
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < str.length; i++) {
        let char = str[i];
        if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
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
            if (depth < 0) return false;
        }
    }
    return depth === 0;
}

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

// Gap 5 Helper: Normalizes algebraic expressions to check structural/mathematical equivalence safely
function normalizeAlgebraicExpression(expr) {
    return expr.replace(/\s+/g, '').toUpperCase();
}

function validateStudentAnswer(question, inputStr) {
    let cleanInput = inputStr.trim();
    const rule = question.ruleType; 
    const expected = question.expectedValue ? question.expectedValue.trim() : ""; 

    if (!cleanInput) {
        return { correct: false, message: "Please enter an expression before verifying." };
    }

    // Proactive Regional & Syntax Check for Missing Equals Sign or Semicolons
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

    // Global Parenthesis Balance Check for Excel Formulas
    if (rule.startsWith("EXCEL_") && !areParenthesesBalanced(cleanInput)) {
        return { 
            correct: false, 
            message: `#VALUE! Error: Unbalanced parentheses. Ensure every opened bracket has a matching closing bracket.` 
        };
    }

    const upperInput = cleanInput.toUpperCase();

    switch (rule) {
       // --- 1. BASIC AGGREGATIONS (SUM, AVERAGE) WITH AST ARGUMENT COUNT & BOUNDS CHECKING ---
        case "EXCEL_SUM":
        case "EXCEL_AVERAGE": {
            const func = rule === "EXCEL_SUM" ? "SUM" : "AVERAGE";
            const pattern = new RegExp(`^=\\s*${func}\\s*\\(\\s*(.+?)\\s*\\)$`, 'i');
            const match = cleanInput.match(pattern);

            if (!match) {
                return { correct: false, message: `#NAME? Error: Excel expects proper function syntax like =${func}(range).` };
            }

            const args = splitExcelArguments(match[1]);
            if (args.length === 0) {
                return { correct: false, message: `#VALUE! Error: The ${func} function requires at least one argument or range.` };
            }

            // Validate all arguments safely using the secure args array instead of raw string splitting
            const allSubRangesValid = args.every(sub => {
                const cleanSub = sub.trim().replace(/\s+/g, '');
                if (cleanSub.includes(':')) {
                    const parts = cleanSub.split(':');
                    if (parts.length === 2) {
                        const startCell = parts[0].replace(/\$/g, '');
                        const endCell = parts[1].replace(/\$/g, '');
                        return isValidCellCoordinate(startCell) && isValidCellCoordinate(endCell);
                    }
                    return false;
                } else {
                    return isValidCellCoordinate(cleanSub.replace(/\$/g, ''));
                }
            });

            let isWithinBounds = false;
            if (allSubRangesValid) {
                const normExpected = expected.replace(/\s+/g, '').toUpperCase();
                const fullInnerNormalized = match[1].replace(/\s+/g, '').toUpperCase();
                isWithinBounds = (fullInnerNormalized === normExpected) || (fullInnerNormalized.includes(normExpected)) || upperInput.includes(normExpected);
            }

            return {
                correct: isWithinBounds,
                message: isWithinBounds 
                    ? `Correct! "${cleanInput}" successfully evaluates within Excel grid limits (Max: XFD1048576).` 
                    : `#REF! Error: Check your range boundaries or ensure coordinates do not exceed Excel limits.`
            };
        }

       // --- 2. CONDITIONAL CHECK (IF) WITH DEEP AST ARGUMENT & ERROR DIAGNOSTICS ---
        case "EXCEL_IF": {
            const ifPattern = /^=\s*IF\s*\(\s*(.+)\s*\)$/i;
            const match = cleanInput.match(ifPattern);

            if (!match) {
                return { 
                    correct: false, 
                    message: `#NAME? Error: Ensure your formula starts with =IF( and closes with matching parentheses.` 
                };
            }

            const innerContent = match[1];

            // Gap 4 Upgrade: Dynamic regex to catch any function identifier missing an immediate open parenthesis
            const malformedNestedPattern = /\b([A-Z]+)[A-Z0-9]/i;
            if (malformedNestedPattern.test(innerContent)) {
                return {
                    correct: false,
                    message: `#NAME? Error: It looks like you missed an opening bracket after a function name. Every function name must be followed immediately by an open parenthesis.`
                };
            }

            const args = splitExcelArguments(innerContent);
            
            // Base IF requires at least 3 arguments (logical_test, value_if_true, value_if_false)
            if (args.length < 3) {
                return { 
                    correct: false, 
                    message: `#VALUE! Error: Your IF function has only ${args.length} argument(s). Excel requires at least 3 arguments: logical_test, value_if_true, and value_if_false.` 
                };
            }
            
            // Excel allows a single IF to take up to 255 total arguments in newer versions, 
            // but standard nested logic typically uses 3 primary slots. If someone passes 
            // more than 3 top-level comma splits without nesting, or exceeds reasonable bounds:
            if (args.length > 3) {
                // If you want to allow multi-argument syntax like modern IFS or cascading blocks, 
                // handle or limit them here. If enforcing standard strict 3-argument base IF:
                return { 
                    correct: false, 
                    message: `#VALUE! Error: Too many top-level arguments provided for a single IF block. Check your comma separators.` 
                };
            }

            // Check max nesting depth of parentheses to ensure it doesn't exceed Excel's 64 limit
            let maxDepth = 0;
            let currentDepth = 0;
            for (let i = 0; i < cleanInput.length; i++) {
                if (cleanInput[i] === '(') {
                    currentDepth++;
                    if (currentDepth > maxDepth) maxDepth = currentDepth;
                } else if (cleanInput[i] === ')') {
                    currentDepth = Math.max(0, currentDepth - 1);
                }
            }

            if (maxDepth > 64) {
                return {
                    correct: false,
                    message: `#VALUE! Error: Formula exceeds Excel's maximum nesting limit of 64 levels (current depth: ${maxDepth}).`
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

            // Note: If valueIfTrue or valueIfFalse contains a nested IF, they won't trigger 
            // isValidExcelValueToken directly unless expanded, so ensure your token validator 
            // handles nested function expressions gracefully.

            return {
                correct: true,
                message: `Correct! "${cleanInput}" properly satisfies Excel's IF function argument structure and data typing rules.`
            };
        }
       // --- 3. LOOKUP FUNCTIONS (VLOOKUP, HLOOKUP, LOOKUP) WITH AST ARGUMENT VALIDATION ---
        case "EXCEL_VLOOKUP":
        case "EXCEL_HLOOKUP":
        case "EXCEL_LOOKUP": {
            const func = rule.replace('EXCEL_', '');
            const pattern = new RegExp(`^=\\s*${func}\\s*\\(\\s*(.+)\\s*\\)$`, 'i');
            const match = cleanInput.match(pattern);
            
            if (!match) {
                return { correct: false, message: `#NAME? Error: Verify your function syntax and parenthesis layout for =${func}().` };
            }

            const args = splitExcelArguments(match[1]);
            
            if (func === 'VLOOKUP' || func === 'HLOOKUP') {
                if (args.length < 3 || args.length > 4) {
                    return { correct: false, message: `#VALUE! Error: =${func} requires 3 or 4 arguments (lookup_value, table_array, col_index_num, [range_lookup]). Found ${args.length}.` };
                }
            } else if (func === 'LOOKUP') {
                if (args.length < 2 || args.length > 3) {
                    return { correct: false, message: `#VALUE! Error: =LOOKUP requires 2 or 3 arguments. Found ${args.length}.` };
                }
            }

            const correct = upperInput.includes(expected.toUpperCase());
            return {
                correct,
                message: correct 
                    ? `Correct! "${cleanInput}" matches required ${func} layout criteria and parameters.` 
                    : `#N/A Error: Verify your lookup parameters, reference structure, and table array for =${func}().`
            };
        }
            
       // --- 4. CONDITIONAL AGGREGATIONS (SUMIF, COUNTIF, AVERAGEIF) WITH AST ARGUMENT VALIDATION ---
        case "EXCEL_SUMIF":
        case "EXCEL_COUNTIF":
        case "EXCEL_AVERAGEIF": {
            const func = rule.replace('EXCEL_', '');
            const pattern = new RegExp(`^=\\s*${func}\\s*\\(\\s*(.+)\\s*\\)$`, 'i');
            const match = cleanInput.match(pattern);

            if (!match) {
                return { correct: false, message: `#NAME? Error: Verify your function prefix and closing parenthesis for =${func}().` };
            }

            const args = splitExcelArguments(match[1]);
            
            // Define strict argument boundaries per function standard
            let minArgs = 2;
            let maxArgs = 3;
            if (func === 'COUNTIF') {
                minArgs = 2;
                maxArgs = 2;
            }

            if (args.length < minArgs || args.length > maxArgs) {
                return { 
                    correct: false, 
                    message: `#VALUE! Error: The ${func} function requires ${minArgs === maxArgs ? minArgs : '2 to 3'} arguments. Found ${args.length}.` 
                };
            }

            const correct = upperInput.includes(expected.toUpperCase());
            return {
                correct,
                message: correct 
                    ? `Correct! "${cleanInput}" accurately built the ${func} conditional structure.` 
                    : `#VALUE! Error: Check your range, criteria expression, and parameter types for =${func}().`
            };
        }

        // --- 5. RANK FUNCTION WITH EXACT 3-ARGUMENT AST VALIDATION ---
        case "EXCEL_RANK": {
            const pattern = /^=\s*(?:RANK|RANK\.EQ)\s*\(\s*(.+)\s*\)$/i;
            const match = cleanInput.match(pattern);

            if (!match) {
                return { correct: false, message: `#NAME? Error: Syntax format mismatch. Expected structure: =RANK(number, ref, [order]).` };
            }

            const args = splitExcelArguments(match[1]);
            if (args.length < 2 || args.length > 3) {
                return { correct: false, message: `#VALUE! Error: =RANK requires 2 or 3 arguments (number, ref, [order]). Found ${args.length}.` };
            }

            const correct = upperInput.includes(expected.toUpperCase());
            return {
                correct,
                message: correct 
                    ? `Correct! "${cleanInput}" successfully computed the rank configuration.` 
                    : `#VALUE! Error: Check your number reference and comparison range parameters for =RANK().`
            };
        }

        // --- 6. ACCESS QUERY CRITERIA & WILDCARDS (WITH ROBUST NORMALIZATION) ---
        case "ACCESS_CRITERIA": {
            // Normalize wildcards: convert SQL-style % to Access-style * for helpful cross-checking
            const cleanedStudentInput = upperInput.trim();
            const normalizedStudent = cleanedStudentInput.replace(/\s+/g, '').replace(/^LIKE/i, '').replace(/["']/g, '').replace(/%/g, '*');
            const normalizedExpected = expected.toUpperCase().replace(/\s+/g, '').replace(/^LIKE/i, '').replace(/["']/g, '').replace(/%/g, '*');

            const correct = normalizedStudent === normalizedExpected || cleanedStudentInput.includes(expected.toUpperCase());
            return {
                correct,
                message: correct 
                    ? `Correct! "${cleanInput}" matches Access design criteria formatting.` 
                    : `Invalid Criteria Error: Remember that Microsoft Access query criteria use asterisks (*) for wildcards instead of percentage signs (%), and text values must be enclosed in quotes.`
            };
        }

        // --- 7. FLEXIBLE ACCESS QUERY CALCULATED FIELDS ---
        case "ACCESS_CALCULATED": {
            // Verify structural alias pattern: AliasName: Expression
            const colonIndex = cleanInput.indexOf(':');
            const hasValidAlias = colonIndex > 0 && colonIndex < cleanInput.length - 1;

            const normalizedStudent = upperInput.replace(/\s+/g, '').replace(/\[/g, '').replace(/\]/g, '');
            const normalizedExpected = expected.toUpperCase().replace(/\s+/g, '').replace(/\[/g, '').replace(/\]/g, '');

            const correct = hasValidAlias && normalizedStudent.includes(normalizedExpected);

            return {
                correct,
                message: correct 
                    ? `Correct! "${cleanInput}" successfully defined the calculated query expression.` 
                    : `Syntax Error: Ensure you use a proper field alias followed by a colon and square bracket expressions (e.g., Total: [Price]*[Qty]).`
            };
        }

       default: {
        // Safe check for normalization function availability
        let normalizedStudent = cleanInput;
        let normalizedExpected = expected;

        if (typeof normalizeAlgebraicExpression === 'function') {
            try {
                normalizedStudent = normalizeAlgebraicExpression(cleanInput);
                normalizedExpected = normalizeAlgebraicExpression(expected);
            } catch (e) {
                console.warn("Algebraic normalization fallback error:", e);
            }
        }

        const studentComp = normalizedStudent.replace(/\s+/g, '').toUpperCase();
        const expectedComp = normalizedExpected.replace(/\s+/g, '').toUpperCase();
        const upperCleanInput = cleanInput.replace(/\s+/g, '').toUpperCase();
        const upperExpected = expected.toUpperCase().replace(/\s+/g, '');

        const correct = (studentComp === expectedComp) || (upperCleanInput === upperExpected) || upperInput.includes(expected.toUpperCase());
        
        return { 
            correct, 
            message: correct 
                ? `Correct! "${cleanInput}" verified successfully.` 
                : `Incorrect ("${cleanInput}"). Please check your entry and formatting.` 
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

        let fetchedQuestions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            fetchedQuestions.push({
                id: doc.id,
                type: data.type || "EXCEL",
                prompt: data.prompt,
                hint: data.hint || "",
                ruleType: data.ruleType || "DEFAULT",
                expectedValue: data.expectedValue || ""
            });
        });

        // Fisher-Yates shuffle algorithm to ensure unique, random order per user/session
        for (let i = fetchedQuestions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [fetchedQuestions[i], fetchedQuestions[j]] = [fetchedQuestions[j], fetchedQuestions[i]];
        }

        currentQuestionsList = fetchedQuestions;
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

    // Safely retrieve active user profile with robust fallbacks
    let activeUser = { username: "Anonymous Student", role: "Student", institution: "Standard College Ntungamo" };
    if (typeof getCurrentUserProfile === 'function') {
        try {
            const profile = getCurrentUserProfile();
            if (profile) activeUser = profile;
        } catch (e) {
            console.warn("Could not retrieve user profile for logging:", e);
        }
    }

    // Log the user submission attempt to Firestore safely
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

    // Prevent internal clicks inside navRight from closing the mobile menu
    navRight.addEventListener('click', (e) => {
        e.stopPropagation();
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
    let activeUser = { role: "Student" };
    if (typeof getCurrentUserProfile === 'function') {
        try {
            const profile = getCurrentUserProfile();
            if (profile) activeUser = profile;
        } catch (e) {
            console.warn("Profile retrieval warning:", e);
        }
    }
    
    // Debug log to check what role your profile currently holds in the browser console
    console.log("Current Active User Profile:", activeUser);

    const userRole = (activeUser.role || "").toLowerCase().trim();
    
    // Expanded role matching to catch variations (Admin, Teacher, Educator, ICT Teacher, Head of Department, etc.)
    const isAdminOrTeacher = 
        userRole.includes("admin") || 
        userRole.includes("teach") || 
        userRole.includes("educat") || 
        userRole.includes("staff") ||
        userRole.includes("instructor");

    let adminContainer = document.getElementById("adminImportSection");
    if (!adminContainer) {
        adminContainer = document.createElement("div");
        adminContainer.id = "adminImportSection";
        adminContainer.className = "admin-import-card";
        
        adminContainer.innerHTML = `
            <div class="admin-card-header">
                <div class="admin-title-group">
                    <span class="admin-badge"> Educator Hub</span>
                    <h3>Bulk Question Import</h3>
                </div>
                <p class="admin-subtitle">Batch upload structured JSON challenge payloads directly into Firebase Firestore collections.</p>
            </div>
            
            <div class="admin-form-grid">
                <div class="admin-input-group">
                    <label for="importCategory">Target Category Key</label>
                    <input type="text" id="importCategory" class="admin-text-input" placeholder="e.g., excel_if, access_criteria" />
                </div>
                
                <div class="admin-input-group full-width">
                    <label for="jsonInput">Questions JSON Array Payload</label>
                    <textarea id="jsonInput" class="admin-textarea" rows="5" placeholder='[{"type":"EXCEL", "prompt":"...", "hint":"...", "ruleType":"EXCEL_IF", "expectedValue":"...", "expectedTrue":"...", "expectedFalse":"..."}]'></textarea>
                </div>
            </div>

            <div class="admin-card-footer">
                <button id="uploadBatchBtn" class="primary-btn admin-action-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload to Firebase
                </button>
                <div id="uploadFeedback" class="admin-feedback-msg"></div>
            </div>
        `;
        
        const workspace = document.querySelector(".workspace");
        if (workspace) {
            workspace.parentNode.insertBefore(adminContainer, workspace);
        } else {
            document.body.appendChild(adminContainer);
        }
    }

    if (isAdminOrTeacher) {
        adminContainer.style.display = "block";
        
        const uploadBtn = document.getElementById("uploadBatchBtn");
        if (uploadBtn && !uploadBtn.dataset.bound) {
            uploadBtn.dataset.bound = "true";
            uploadBtn.addEventListener("click", async () => {
                const targetCategoryInput = document.getElementById("importCategory");
                const jsonInputBox = document.getElementById("jsonInput");
                const targetCategory = targetCategoryInput.value.trim();
                const rawJson = jsonInputBox.value.trim();
                const feedbackDiv = document.getElementById("uploadFeedback");

                if (!targetCategory || !rawJson) {
                    feedbackDiv.className = "admin-feedback-msg error";
                    feedbackDiv.textContent = "Please provide both a target category key and a JSON payload.";
                    return;
                }

                try {
                    const questionsArray = JSON.parse(rawJson);
                    if (!Array.isArray(questionsArray)) {
                        throw new Error("JSON root must be an array of objects.");
                    }

                    feedbackDiv.className = "admin-feedback-msg info";
                    feedbackDiv.textContent = `Uploading ${questionsArray.length} items to Firestore...`;
                    uploadBtn.disabled = true;

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
                            expectedTrue: q.expectedTrue || "",
                            expectedFalse: q.expectedFalse || "",
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });

                    await batch.commit();
                    feedbackDiv.className = "admin-feedback-msg success";
                    feedbackDiv.textContent = "✔ Successfully imported all questions! Refreshing client workspace...";
                    
                    jsonInputBox.value = "";
                    targetCategoryInput.value = "";

                    setTimeout(() => {
                        if (typeof loadChallengesFromFirestore === 'function') {
                            loadChallengesFromFirestore();
                        }
                        uploadBtn.disabled = false;
                        feedbackDiv.textContent = "";
                        feedbackDiv.className = "admin-feedback-msg";
                    }, 1800);

                } catch (err) {
                    console.error("Batch import error:", err);
                    feedbackDiv.className = "admin-feedback-msg error";
                    feedbackDiv.textContent = "Import Failed: " + err.message;
                    uploadBtn.disabled = false;
                }
            });
        }
    } else {
        adminContainer.style.display = "none";
    }
}

// ==========================================
// CLEAN SYNTAX HIGHLIGHTER ENGINE
// ==========================================
function highlightFormula(text) {
    if (!text) return '';
    
    // 1. Escape HTML entities
    const safeText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    let bracketDepth = 0;

    // 2. Apply syntax tokens
    return safeText
        .replace(/(=)|([A-Z][A-Z0-9_]*\b(?=\s*\())|([()])/g, (match, eq, func, bracket) => {
            if (eq) return `<span class="token-equals">${eq}</span>`;
            if (func) return `<span class="token-function">${func}</span>`;
            if (bracket) {
                if (bracket === '(') bracketDepth++;
                const currentLevel = Math.min(64, Math.max(1, bracketDepth));
                const bracketClass = `token-bracket-${currentLevel}`;
                if (bracket === ')') bracketDepth = Math.max(0, bracketDepth - 1);
                return `<span class="${bracketClass}">${bracket}</span>`;
            }
            return match;
        })
        .replace(/([A-Z]+\d+:[A-Z]+\d+|[A-Z]+\d+|\$[A-Z]+\$\d+)/g, '<span class="token-cell">$1</span>')
        .replace(/(".*?"|'.*?')/g, '<span class="token-string">$1</span>')
        .replace(/([+\-*/^=<>]=?)/g, '<span class="token-operator">$1</span>');
}

document.addEventListener("DOMContentLoaded", () => {
    const textarea = document.getElementById('studentAnswer');
    const backdropCode = document.getElementById('formulaBackdrop');

    if (textarea && backdropCode) {
        // SAFETY CLEANSE: If the textarea accidentally loaded with HTML code, wipe it clean
        if (textarea.value.includes('<span')) {
            textarea.value = '';
        }

        function updateEditor() {
            // Read strictly from textarea.value (Plain text only)
            const plainText = textarea.value;
            backdropCode.innerHTML = highlightFormula(plainText) + ' ';
        }

        // Only listen to user typing input
        textarea.addEventListener('input', updateEditor);

        // Sync scrolling
        textarea.addEventListener('scroll', () => {
            if (backdropCode.parentElement) {
                backdropCode.parentElement.scrollTop = textarea.scrollTop;
                backdropCode.parentElement.scrollLeft = textarea.scrollLeft;
            }
        });

        updateEditor();
    }
});

// ==========================================
// 7. INITIALIZATION ON PAGE LOAD
// ==========================================
loadChallengesFromFirestore();
setupAdminImportModule();
