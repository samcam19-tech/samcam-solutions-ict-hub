// Function to retrieve the active user session dynamically based on your portal setup
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

const challenges = {
    excel_if: {
        type: "EXCEL",
        prompt: "Write an Excel formula using the IF function to return 'Pass' if the score in cell B2 is greater than or equal to 50, otherwise return 'Fail'.",
        hint: "Syntax format: =IF(condition, value_if_true, value_if_false)",
        validate: (inputStr) => {
            const clean = inputStr.trim().toUpperCase();
            if (!clean.startsWith("=")) {
                return { correct: false, message: "Formula must start with an equals sign (=)." };
            }
            if (!clean.includes("IF(")) {
                return { correct: false, message: "You must use the IF function." };
            }
            if (clean.includes("B2") && (clean.includes(">=50") || clean.includes(">49") || clean.includes("50<=B2"))) {
                return { correct: true, message: "Correct! Your logical condition and outcomes for the IF function are properly structured." };
            }
            return { correct: false, message: "Check your condition logic. Make sure you check cell B2 against 50 with correct comparison operators." };
        }
    },
    excel_vlookup: {
        type: "EXCEL",
        prompt: "Write a VLOOKUP formula to find a student ID located in cell A5, searching within the range D2:F20, returning the value from the 3rd column, with an exact match (0 or FALSE).",
        hint: "Syntax format: =VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])",
        validate: (inputStr) => {
            const clean = inputStr.trim().toUpperCase();
            if (!clean.startsWith("=")) {
                return { correct: false, message: "Formula must start with an equals sign (=)." };
            }
            if (!clean.includes("VLOOKUP(")) {
                return { correct: false, message: "You must use the VLOOKUP function." };
            }
            if (clean.includes("A5") && clean.includes("D2:F20") && clean.includes("3")) {
                return { correct: true, message: "Excellent! Your lookup value, table array range, and column index are correct." };
            }
            return { correct: false, message: "Check your arguments: lookup value should be A5, table range D2:F20, and column index 3." };
        }
    },
    excel_hlookup: {
        type: "EXCEL",
        prompt: "Write an HLOOKUP formula to search for 'Region' in cell B1 across table range A1:E5, returning the row index 3 with an exact match.",
        hint: "Syntax format: =HLOOKUP(lookup_value, table_array, row_index_num, [range_lookup])",
        validate: (inputStr) => {
            const clean = inputStr.trim().toUpperCase();
            if (!clean.startsWith("=")) {
                return { correct: false, message: "Formula must start with an equals sign (=)." };
            }
            if (!clean.includes("HLOOKUP(")) {
                return { correct: false, message: "You must use the HLOOKUP function." };
            }
            if (clean.includes("B1") && clean.includes("A1:E5") && clean.includes("3")) {
                return { correct: true, message: "Correct! HLOOKUP horizontal search arguments are well formed." };
            }
            return { correct: false, message: "Ensure lookup value is B1, range is A1:E5, and row index is 3." };
        }
    },
    excel_lookup: {
        type: "EXCEL",
        prompt: "Write a classic LOOKUP formula to look up value in cell A2 within vector lookup range A10:A20 and return result from result vector B10:B20.",
        hint: "Syntax format: =LOOKUP(lookup_value, lookup_vector, result_vector)",
        validate: (inputStr) => {
            const clean = inputStr.trim().toUpperCase();
            if (!clean.startsWith("=")) {
                return { correct: false, message: "Formula must start with an equals sign (=)." };
            }
            if (!clean.includes("LOOKUP(")) {
                return { correct: false, message: "You must use the LOOKUP function." };
            }
            if (clean.includes("A2") && clean.includes("A10:A20") && clean.includes("B10:B20")) {
                return { correct: true, message: "Great job! Vector form LOOKUP is correctly configured." };
            }
            return { correct: false, message: "Verify lookup value A2, lookup vector A10:A20, and result vector B10:B20." };
        }
    },
    excel_sumif: {
        type: "EXCEL",
        prompt: "Write a SUMIF formula to sum values in range C2:C15 if the criteria range B2:B15 matches 'ICT'.",
        hint: "Syntax format: =SUMIF(range, criteria, [sum_range])",
        validate: (inputStr) => {
            const clean = inputStr.trim().toUpperCase();
            if (!clean.startsWith("=")) {
                return { correct: false, message: "Formula must start with an equals sign (=)." };
            }
            if (!clean.includes("SUMIF(")) {
                return { correct: false, message: "You must use the SUMIF function." };
            }
            if (clean.includes("B2:B15") && clean.includes("C2:C15") && clean.includes("ICT")) {
                return { correct: true, message: "Spot on! Your SUMIF criteria range, condition, and sum range are correct." };
            }
            return { correct: false, message: "Double-check your ranges (B2:B15 for criteria, C2:C15 for sum) and ensure 'ICT' is included." };
        }
    },
    excel_countif: {
        type: "EXCEL",
        prompt: "Write a COUNTIF formula to count how many times 'Pass' appears in the range D2:D25.",
        hint: "Syntax format: =COUNTIF(range, criteria)",
        validate: (inputStr) => {
            const clean = inputStr.trim().toUpperCase();
            if (!clean.startsWith("=")) {
                return { correct: false, message: "Formula must start with an equals sign (=)." };
            }
            if (!clean.includes("COUNTIF(")) {
                return { correct: false, message: "You must use the COUNTIF function." };
            }
            if (clean.includes("D2:D25") && clean.includes("PASS")) {
                return { correct: true, message: "Correct! COUNTIF range and condition are properly defined." };
            }
            return { correct: false, message: "Ensure range is D2:D25 and criteria is 'Pass'." };
        }
    },
    excel_averageif: {
        type: "EXCEL",
        prompt: "Write an AVERAGEIF formula to calculate the average of scores in range C2:C20 where the corresponding gender in range A2:A20 equals 'F'.",
        hint: "Syntax format: =AVERAGEIF(range, criteria, [average_range])",
        validate: (inputStr) => {
            const clean = inputStr.trim().toUpperCase();
            if (!clean.startsWith("=")) {
                return { correct: false, message: "Formula must start with an equals sign (=)." };
            }
            if (!clean.includes("AVERAGEIF(")) {
                return { correct: false, message: "You must use the AVERAGEIF function." };
            }
            if (clean.includes("A2:A20") && clean.includes("C2:C20") && clean.includes("F")) {
                return { correct: true, message: "Excellent! AVERAGEIF criteria range, condition, and average range are correctly set." };
            }
            return { correct: false, message: "Check ranges: A2:A20 for criteria, C2:C20 for average range, with criteria 'F'." };
        }
    },
    access_criteria: {
        type: "ACCESS",
        prompt: "Write Microsoft Access query criteria to filter records where the City field starts with 'K' or equals 'Kampala'.",
        hint: "Remember Access wildcard rules: use Like 'K*' or exact string comparisons.",
        validate: (inputStr) => {
            const clean = inputStr.trim().toUpperCase();
            if (clean.includes("LIKE") && (clean.includes("K*") || clean.includes("K%")) || clean.includes("KAMPALA")) {
                return { correct: true, message: "Correct! Proper handling of Access criteria matching operators." };
            }
            return { correct: false, message: "In Access, use 'Like \"K*\"' or explicit text matching criteria." };
        }
    }
};

const challengeSelect = document.getElementById("challengeSelect");
const challengePrompt = document.getElementById("challengePrompt");
const challengeHint = document.getElementById("challengeHint");
const studentAnswer = document.getElementById("studentAnswer");
const verifyBtn = document.getElementById("verifyBtn");
const feedbackOutput = document.getElementById("feedbackOutput");

function loadSelectedChallenge() {
    const selectedKey = challengeSelect.value;
    const current = challenges[selectedKey];
    challengePrompt.textContent = current.prompt;
    challengeHint.textContent = "Hint: " + current.hint;
    studentAnswer.value = "";
    feedbackOutput.className = "feedback-placeholder";
    feedbackOutput.textContent = "Submit an answer to see real-time verification and grading.";
}

challengeSelect.addEventListener("change", loadSelectedChallenge);

verifyBtn.addEventListener("click", async () => {
    const selectedKey = challengeSelect.value;
    const current = challenges[selectedKey];
    const val = studentAnswer.value;

    if (!val.trim()) {
        feedbackOutput.className = "feedback-incorrect";
        feedbackOutput.textContent = "Please enter an expression before verifying.";
        return;
    }

    const result = current.validate(val);
    if (result.correct) {
        feedbackOutput.className = "feedback-correct";
        feedbackOutput.textContent = "✔ " + result.message;
    } else {
        feedbackOutput.className = "feedback-incorrect";
        feedbackOutput.textContent = "✘ " + result.message;
    }

    // Retrieve active session dynamically using the portal_session logic
    const activeUser = getCurrentUserProfile();

    // Save attempt to Firestore including the live session profile fields
    if (typeof db !== 'undefined') {
        try {
            await db.collection("formulaSubmissions").add({
                challengeId: selectedKey,
                challengeType: current.type,
                submission: val,
                isCorrect: result.correct,
                feedbackMessage: result.message,
                user: activeUser.username || activeUser.name || "Unknown",
                role: activeUser.role || "Student",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log("Submission successfully saved to Firestore with portal_session context!");
        } catch (error) {
            console.error("Error saving submission to Firestore: ", error);
        }
    }
});

loadSelectedChallenge();
