export interface LocalQuestion {
  id: string;
  classLevel: number;
  subject: string;
  chapter: string;
  question: string;
  bestAnswer: string;
  examReadyAnswer: string;
  stepByStep: string[];
  keyConcept: string;
  commonMistake: string;
  memoryTrick: string;
  examTip: string;
  quizQuestion: string;
  quizOptions: string[];
  correctQuizOption: string;
  quizExplanation: string;
}

export const sampleQuestions: LocalQuestion[] = [
  {
    id: "math-8-1",
    classLevel: 8,
    subject: "Maths",
    chapter: "Linear Equations in One Variable",
    question: "What is a linear equation in one variable?",
    bestAnswer: "A linear equation in one variable is an equation of the form ax + b = 0, where a ≠ 0 and x is the variable.",
    examReadyAnswer: "A linear equation in one variable is an algebraic equation of the form ax + b = 0, where a and b are constants and a ≠ 0. It has exactly one solution. Example: 2x + 4 = 0 gives x = -2.",
    stepByStep: [
      "Step 1: Identify the variable (usually x).",
      "Step 2: Write in standard form ax + b = 0.",
      "Step 3: Isolate the variable by transposing constants.",
      "Step 4: Divide both sides by the coefficient of x.",
      "Step 5: Verify the solution by substituting back."
    ],
    keyConcept: "A linear equation has degree 1 and exactly one solution.",
    commonMistake: "Students forget to change the sign when transposing terms from one side to another.",
    memoryTrick: "LIPS – Linear = 1 Power, Isolate the variable, Put answer back, Solve step by step.",
    examTip: "Always verify your answer by substituting it back into the original equation.",
    quizQuestion: "Solve: 3x - 9 = 0",
    quizOptions: ["x = 3", "x = -3", "x = 9", "x = -9"],
    correctQuizOption: "x = 3",
    quizExplanation: "3x = 9, so x = 9/3 = 3."
  },
  {
    id: "math-9-1",
    classLevel: 9,
    subject: "Maths",
    chapter: "Polynomials",
    question: "What is a polynomial? Give an example.",
    bestAnswer: "A polynomial is an algebraic expression consisting of variables and coefficients, involving only non-negative integer powers of variables.",
    examReadyAnswer: "A polynomial is an algebraic expression of the form p(x) = aₙxⁿ + aₙ₋₁xⁿ⁻¹ + ... + a₁x + a₀, where aₙ ≠ 0 and n is a non-negative integer. Example: p(x) = 3x² + 2x - 5 is a polynomial of degree 2.",
    stepByStep: [
      "Step 1: Identify all terms with non-negative integer exponents.",
      "Step 2: Write in descending order of powers.",
      "Step 3: Identify the degree (highest power).",
      "Step 4: Name the type: monomial (1 term), binomial (2 terms), trinomial (3 terms).",
      "Step 5: Verify no term has a negative or fractional exponent."
    ],
    keyConcept: "In a polynomial, all exponents must be whole numbers (0, 1, 2, 3...) and the coefficient of the leading term must be non-zero.",
    commonMistake: "Expressions like 1/x or √x are NOT polynomials because they have negative or fractional exponents.",
    memoryTrick: "POLYnomial = POLY (many) terms, all with POSITIVE WHOLE number powers.",
    examTip: "The degree of a polynomial determines the maximum number of roots it can have.",
    quizQuestion: "Which of the following is NOT a polynomial?",
    quizOptions: ["x² + 2x + 1", "3x³ - x", "x + 1/x", "5"],
    correctQuizOption: "x + 1/x",
    quizExplanation: "x + 1/x = x + x⁻¹ has a negative exponent, so it is not a polynomial."
  },
  {
    id: "math-10-1",
    classLevel: 10,
    subject: "Maths",
    chapter: "Real Numbers",
    question: "State the Fundamental Theorem of Arithmetic.",
    bestAnswer: "Every composite number can be expressed as a product of primes, and this factorization is unique, apart from the order in which the prime factors occur.",
    examReadyAnswer: "The Fundamental Theorem of Arithmetic states that every integer greater than 1 is either a prime number itself OR can be written as a unique product of prime numbers (up to the order of factors). Example: 12 = 2 × 2 × 3 = 2² × 3.",
    stepByStep: [
      "Step 1: Take any composite number (e.g., 360).",
      "Step 2: Divide by the smallest prime factor (2): 360 = 2 × 180.",
      "Step 3: Continue dividing: 180 = 2 × 90, 90 = 2 × 45, 45 = 3 × 15, 15 = 3 × 5.",
      "Step 4: Write as product: 360 = 2³ × 3² × 5.",
      "Step 5: This factorization is unique regardless of method used."
    ],
    keyConcept: "Prime factorization of any composite number is unique — there is only one way to write it as a product of primes.",
    commonMistake: "Students confuse prime and composite numbers. Remember: 1 is neither prime nor composite.",
    memoryTrick: "FUNKY PRIME – Every number has its own UNIQUE prime fingerprint.",
    examTip: "Use the factor tree method to quickly find prime factorization. LCM and HCF problems always use this theorem.",
    quizQuestion: "What is the prime factorization of 72?",
    quizOptions: ["2³ × 3²", "2² × 3³", "2 × 36", "8 × 9"],
    correctQuizOption: "2³ × 3²",
    quizExplanation: "72 = 8 × 9 = 2³ × 3²."
  },
  {
    id: "sci-8-1",
    classLevel: 8,
    subject: "Science",
    chapter: "Cell — Structure and Functions",
    question: "What is a cell and why is it called the basic unit of life?",
    bestAnswer: "A cell is the smallest structural and functional unit of life. It is called the basic unit of life because all living organisms are made of cells, and all life processes occur within cells.",
    examReadyAnswer: "A cell is the smallest structural and functional unit of a living organism. It is called the basic unit of life because: (1) All organisms are made of one or more cells. (2) All metabolic activities like respiration, nutrition, and excretion occur in cells. (3) New cells arise from pre-existing cells (cell theory).",
    stepByStep: [
      "Step 1: Define cell — smallest unit of life.",
      "Step 2: State cell theory — all organisms made of cells.",
      "Step 3: Explain functions — metabolism, reproduction, growth.",
      "Step 4: Mention types — prokaryotic (no nucleus) and eukaryotic (with nucleus).",
      "Step 5: Give examples — bacteria (prokaryotic), plant/animal cells (eukaryotic)."
    ],
    keyConcept: "Cell Theory: (1) All living organisms are made of cells. (2) Cell is the basic unit of life. (3) All cells arise from pre-existing cells.",
    commonMistake: "Students confuse cell membrane and cell wall. Cell wall is only in plant cells; cell membrane is in all cells.",
    memoryTrick: "CELLS = Center of Every Living Life System.",
    examTip: "Always draw a labelled diagram of plant and animal cell in exams. Know the differences: cell wall, chloroplast, large vacuole are in plant cells only.",
    quizQuestion: "Which organelle is called the 'powerhouse of the cell'?",
    quizOptions: ["Nucleus", "Mitochondria", "Ribosome", "Golgi body"],
    correctQuizOption: "Mitochondria",
    quizExplanation: "Mitochondria produce ATP energy through cellular respiration, earning the nickname 'powerhouse of the cell'."
  },
  {
    id: "sci-9-1",
    classLevel: 9,
    subject: "Science",
    chapter: "Matter in Our Surroundings",
    question: "What are the characteristics of matter?",
    bestAnswer: "Matter has mass, occupies space, has intermolecular forces, and exists in three states: solid, liquid, and gas.",
    examReadyAnswer: "Matter is anything that has mass and occupies space. Key characteristics: (1) Made of tiny particles. (2) Particles are in constant motion. (3) Particles have spaces between them. (4) Particles attract each other (intermolecular forces). (5) Exists in three states — solid, liquid, gas — which can be changed by temperature and pressure.",
    stepByStep: [
      "Step 1: Matter = anything with mass + occupies volume.",
      "Step 2: All matter is made of tiny particles (atoms/molecules).",
      "Step 3: These particles have kinetic energy and are always moving.",
      "Step 4: Intermolecular forces determine the state of matter.",
      "Step 5: Heating increases kinetic energy → state changes (solid→liquid→gas)."
    ],
    keyConcept: "The state of matter depends on the balance between kinetic energy of particles and intermolecular forces of attraction.",
    commonMistake: "Students confuse evaporation and boiling. Evaporation occurs at any temperature from the surface; boiling occurs at a fixed temperature throughout the liquid.",
    memoryTrick: "SLiG – Solid (rigid), Liquid (flows), Gas (fills container). Temperature increases → moves from S to L to G.",
    examTip: "Learn the definitions of melting point, boiling point, latent heat, and sublimation with examples.",
    quizQuestion: "Which process converts a solid directly into gas?",
    quizOptions: ["Melting", "Evaporation", "Sublimation", "Condensation"],
    correctQuizOption: "Sublimation",
    quizExplanation: "Sublimation is the direct conversion of solid to gas without passing through the liquid state. Example: dry ice (solid CO₂) sublimes."
  },
  {
    id: "sci-10-1",
    classLevel: 10,
    subject: "Science",
    chapter: "Chemical Reactions and Equations",
    question: "What is a chemical equation and how do you balance it?",
    bestAnswer: "A chemical equation represents a chemical reaction using symbols and formulas. It is balanced by adjusting coefficients so the number of atoms of each element is equal on both sides.",
    examReadyAnswer: "A chemical equation is a symbolic representation of a chemical reaction showing reactants on the left and products on the right, separated by an arrow (→). Balancing follows the Law of Conservation of Mass. Method: (1) Write unbalanced equation. (2) Count atoms on each side. (3) Add coefficients (not subscripts) to balance. (4) Verify. Example: H₂ + O₂ → H₂O becomes 2H₂ + O₂ → 2H₂O.",
    stepByStep: [
      "Step 1: Write the skeleton (word) equation.",
      "Step 2: Write chemical formulas for all reactants and products.",
      "Step 3: Count atoms of each element on both sides.",
      "Step 4: Add coefficients to the formulas to equalize atom counts.",
      "Step 5: Verify that all atoms are balanced and write the state symbols (s, l, g, aq)."
    ],
    keyConcept: "Law of Conservation of Mass: Matter cannot be created or destroyed. Total mass of reactants = Total mass of products.",
    commonMistake: "Never change subscripts to balance — only change coefficients. Changing subscripts changes the substance itself.",
    memoryTrick: "BALANCE = Both Atoms Left And Never Change Equations' Subscripts.",
    examTip: "Always include state symbols: (s) solid, (l) liquid, (g) gas, (aq) aqueous solution. Marks are deducted without them.",
    quizQuestion: "What is added to balance a chemical equation?",
    quizOptions: ["Subscripts", "Coefficients", "New atoms", "Different elements"],
    correctQuizOption: "Coefficients",
    quizExplanation: "Coefficients (numbers placed before formulas) are changed to balance equations. Subscripts cannot be changed as they define the compound."
  },
  {
    id: "sst-8-1",
    classLevel: 8,
    subject: "Social Science",
    chapter: "The Indian Constitution",
    question: "What are the Fundamental Rights guaranteed by the Indian Constitution?",
    bestAnswer: "The Indian Constitution guarantees six Fundamental Rights: Right to Equality, Right to Freedom, Right against Exploitation, Right to Freedom of Religion, Cultural and Educational Rights, and Right to Constitutional Remedies.",
    examReadyAnswer: "The Indian Constitution guarantees six Fundamental Rights (Part III, Articles 12-35): (1) Right to Equality (Art. 14-18): No discrimination based on religion, race, caste, sex. (2) Right to Freedom (Art. 19-22): Freedom of speech, assembly, movement. (3) Right against Exploitation (Art. 23-24): Prohibition of forced labour and child labour. (4) Right to Freedom of Religion (Art. 25-28). (5) Cultural and Educational Rights (Art. 29-30). (6) Right to Constitutional Remedies (Art. 32): Dr. Ambedkar called it the 'heart and soul' of the Constitution.",
    stepByStep: [
      "Step 1: Fundamental Rights are in Part III of the Constitution.",
      "Step 2: Originally 7, now 6 (Right to Property removed in 1978, made a legal right).",
      "Step 3: Right to Equality — no discrimination, equal opportunity.",
      "Step 4: Right to Freedom — 6 freedoms including speech and movement.",
      "Step 5: Right to Constitutional Remedies — can move court if rights are violated."
    ],
    keyConcept: "Fundamental Rights are justiciable — if violated, citizens can directly approach the Supreme Court (Art. 32) or High Court (Art. 226).",
    commonMistake: "Students confuse Fundamental Rights (justiciable) with Directive Principles (non-justiciable). DPSPs guide the government but cannot be enforced in court.",
    memoryTrick: "EFEC-CR: Equality, Freedom, Exploitation, Cultural, Constitutional Remedies — Every Free Equal Citizen Can Remedy.",
    examTip: "Remember Article numbers: Art. 32 (Right to Constitutional Remedies), Art. 21 (Right to Life), Art. 14 (Equality). These appear frequently in board exams.",
    quizQuestion: "Which article is called the 'heart and soul' of the Indian Constitution?",
    quizOptions: ["Article 14", "Article 19", "Article 21", "Article 32"],
    correctQuizOption: "Article 32",
    quizExplanation: "Article 32 (Right to Constitutional Remedies) was called the 'heart and soul' of the Constitution by Dr. B.R. Ambedkar as it allows citizens to enforce their Fundamental Rights."
  },
  {
    id: "sst-9-1",
    classLevel: 9,
    subject: "Social Science",
    chapter: "The French Revolution",
    question: "What were the main causes of the French Revolution?",
    bestAnswer: "The French Revolution (1789) was caused by financial crisis, social inequality (Estate system), political despotism, and Enlightenment ideas.",
    examReadyAnswer: "The main causes of the French Revolution (1789) were: (1) Financial crisis — France was bankrupt due to wars and lavish royal spending. (2) Social inequality — the Estate system divided society: First Estate (clergy), Second Estate (nobility), Third Estate (common people) bore all tax burden. (3) Food scarcity — bad harvests caused bread prices to rise. (4) Political causes — absolute monarchy of Louis XVI with no representation. (5) Intellectual causes — Enlightenment ideas of liberty, equality, fraternity by philosophers like Rousseau and Voltaire.",
    stepByStep: [
      "Step 1: Financial crisis — France spent hugely on American War of Independence.",
      "Step 2: Social structure — Three Estates: Clergy, Nobility, Commoners.",
      "Step 3: Tax burden — only the Third Estate paid taxes; Church and Nobles were exempt.",
      "Step 4: Bad harvests of 1788 → bread shortage → starvation among poor.",
      "Step 5: Enlightenment ideas + weak king Louis XVI → revolution erupted in 1789."
    ],
    keyConcept: "The three ideals of the French Revolution — Liberté (Liberty), Égalité (Equality), Fraternité (Fraternity) — influenced democratic movements worldwide.",
    commonMistake: "Students confuse the Estates General (assembly) with the National Assembly. The Third Estate formed the National Assembly after being dismissed from Estates General.",
    memoryTrick: "FSSPE: Financial, Social, Scarcity, Political, Enlightenment — Five causes of French Revolution.",
    examTip: "Know key dates: 1789 (Revolution begins, Bastille stormed on July 14), 1792 (Republic declared), 1793 (Louis XVI executed). The Declaration of Rights of Man (1789) is very important.",
    quizQuestion: "The storming of the Bastille on July 14, 1789 symbolized:",
    quizOptions: ["End of Napoleon's rule", "Fall of royal power and tyranny", "Declaration of war with Britain", "Signing of the Constitution"],
    correctQuizOption: "Fall of royal power and tyranny",
    quizExplanation: "The Bastille was a royal prison symbolizing the king's tyranny. Its storming on July 14, 1789 marked the beginning of the French Revolution and is now celebrated as Bastille Day."
  },
  {
    id: "sst-10-1",
    classLevel: 10,
    subject: "Social Science",
    chapter: "Nationalism in India",
    question: "What was the Non-Cooperation Movement and why was it launched?",
    bestAnswer: "The Non-Cooperation Movement (1920-22) was launched by Gandhi to protest against British rule, especially the Jallianwala Bagh massacre and the Rowlatt Act, by withdrawing cooperation from the government.",
    examReadyAnswer: "The Non-Cooperation Movement (1920-1922) was launched by Mahatma Gandhi under the Indian National Congress. Reasons: (1) Jallianwala Bagh massacre (1919). (2) Rowlatt Act (1919) allowed detention without trial. (3) Khilafat issue — Muslims joined against British treatment of the Caliph. Key features: boycott of government schools, courts, elections, and foreign goods; surrender of titles; promotion of swadeshi. It was withdrawn after the Chauri Chaura incident (1922), where a mob burned a police station.",
    stepByStep: [
      "Step 1: Context — World War I promised self-rule but led to Rowlatt Act instead.",
      "Step 2: Jallianwala Bagh (April 13, 1919) — General Dyer fired on unarmed crowd; hundreds killed.",
      "Step 3: Gandhi launched Non-Cooperation Movement in September 1920.",
      "Step 4: Means of non-cooperation: boycott schools, courts, councils, foreign cloth.",
      "Step 5: Chauri Chaura (Feb 1922) — mob violence → Gandhi called off the movement."
    ],
    keyConcept: "Non-Cooperation means withdrawing all support from an unjust government. Gandhi believed non-violence (ahimsa) was essential — any violence would undermine the moral authority of the movement.",
    commonMistake: "Students confuse Non-Cooperation Movement (1920-22) with Civil Disobedience Movement (1930). CDM involved breaking specific unjust laws like the Salt Law.",
    memoryTrick: "NCC – Non-cooperation, Chauri Chaura caused Cancellation.",
    examTip: "The Chauri Chaura incident and Gandhi's withdrawal of the movement is a frequently asked question. Always mention the date (February 5, 1922) and Gandhi's reason (violence is against the principles of satyagraha).",
    quizQuestion: "Why did Gandhi withdraw the Non-Cooperation Movement in 1922?",
    quizOptions: ["British granted independence", "Chauri Chaura violence", "Gandhi was arrested", "Congress opposed the movement"],
    correctQuizOption: "Chauri Chaura violence",
    quizExplanation: "At Chauri Chaura, a mob attacked and burned a police station, killing policemen. Gandhi felt violence had entered the movement and withdrew it, saying non-violence was the core principle."
  },
  {
    id: "eng-8-1",
    classLevel: 8,
    subject: "English",
    chapter: "Grammar — Tenses",
    question: "What are the different types of tenses in English? Explain with examples.",
    bestAnswer: "There are three main tenses: Present, Past, and Future, each with four aspects: Simple, Continuous, Perfect, and Perfect Continuous.",
    examReadyAnswer: "Tenses show the time of an action. Three main tenses, each with 4 forms: (1) Present: Simple (I eat), Continuous (I am eating), Perfect (I have eaten), Perfect Continuous (I have been eating). (2) Past: Simple (I ate), Continuous (I was eating), Perfect (I had eaten), Perfect Continuous (I had been eating). (3) Future: Simple (I will eat), Continuous (I will be eating), Perfect (I will have eaten), Perfect Continuous (I will have been eating). Total = 12 tense forms.",
    stepByStep: [
      "Step 1: Identify the time of the action (past, present, future).",
      "Step 2: Identify the aspect — simple (habit/fact), continuous (ongoing), perfect (completed), perfect continuous (ongoing until a point).",
      "Step 3: Use correct auxiliary verb: am/is/are (present cont.), was/were (past cont.), will (future), have/has (present perfect), had (past perfect).",
      "Step 4: Use correct form of main verb: V1 (simple), V1+ing (continuous), V3 (perfect).",
      "Step 5: Practice by converting sentences from one tense to another."
    ],
    keyConcept: "Signal words help identify tenses: 'yesterday/ago' → past simple; 'just/already/yet' → present perfect; 'since/for' → perfect continuous.",
    commonMistake: "Students use present continuous for habitual actions. Wrong: 'I am going to school daily.' Correct: 'I go to school daily' (simple present for habits).",
    memoryTrick: "3 × 4 = 12: Three time periods × Four aspects = 12 total tense forms. PPF (Past, Present, Future) × SCPP (Simple, Continuous, Perfect, Perfect Continuous).",
    examTip: "In gap-fill or error-correction questions, look for signal words (yesterday, since, for, already, yet, when, while) — they indicate which tense to use.",
    quizQuestion: "Which tense is used for an action that started in the past and is still continuing?",
    quizOptions: ["Simple Past", "Past Perfect", "Present Perfect Continuous", "Simple Present"],
    correctQuizOption: "Present Perfect Continuous",
    quizExplanation: "Present Perfect Continuous (have/has + been + V-ing) shows an action that started in the past and is still continuing. Example: 'I have been studying for 3 hours.'"
  },
  {
    id: "eng-9-1",
    classLevel: 9,
    subject: "English",
    chapter: "Writing — Formal Letter",
    question: "How do you write a formal letter? What is its format?",
    bestAnswer: "A formal letter follows a specific format: sender's address, date, receiver's address, subject, salutation, body, complimentary close, and signature.",
    examReadyAnswer: "A formal letter format: (1) Sender's Address (top right/left). (2) Date. (3) Receiver's Name and Address. (4) Subject (brief, underlined). (5) Salutation: 'Sir/Madam' or 'Respected Sir/Ma'am'. (6) Body: Introduction (purpose), Main content, Conclusion (request/action expected). (7) Complimentary Close: 'Yours faithfully' (if salutation is Sir/Madam) or 'Yours sincerely' (if name used). (8) Signature and name. Tone must be polite, formal, and precise.",
    stepByStep: [
      "Step 1: Write sender's address and date (top right or left as per format).",
      "Step 2: Write receiver's designation and address.",
      "Step 3: Write subject line — brief and clear, underlined.",
      "Step 4: Begin with 'Respected Sir/Madam' or 'Dear Sir/Madam'.",
      "Step 5: Write body in 3 parts — purpose, details, request. End with 'Yours faithfully' + signature."
    ],
    keyConcept: "Formal letters are written to officials, authorities, or organizations. The tone is always formal and polite. 'Yours faithfully' is used when you don't know the name; 'Yours sincerely' when you do.",
    commonMistake: "Students mix up 'Yours faithfully' and 'Yours sincerely'. Rule: If salutation is 'Dear Sir/Madam' → 'Yours faithfully'. If salutation uses a name (Dear Mr. Sharma) → 'Yours sincerely'.",
    memoryTrick: "SADSBCS: Sender, Address, Date, Subject, Body, Close, Signature — the 7 parts of a formal letter.",
    examTip: "In CBSE board exams, formal letters are 5 marks. Always write a subject line, use formal language, and check salutation-close matching. Word limit is approximately 100-150 words.",
    quizQuestion: "Which closing is correct when the salutation is 'Dear Sir'?",
    quizOptions: ["Yours lovingly", "Yours sincerely", "Yours faithfully", "Regards"],
    correctQuizOption: "Yours faithfully",
    quizExplanation: "When the salutation is 'Sir' or 'Madam' (name not known), use 'Yours faithfully'. 'Yours sincerely' is used when the name is known and used in salutation."
  },
  {
    id: "math-10-2",
    classLevel: 10,
    subject: "Maths",
    chapter: "Triangles",
    question: "State and prove the Pythagoras theorem.",
    bestAnswer: "Pythagoras theorem states that in a right-angled triangle, the square of the hypotenuse equals the sum of squares of the other two sides: a² + b² = c².",
    examReadyAnswer: "Pythagoras Theorem: In a right-angled triangle, the square of the hypotenuse (longest side, opposite the right angle) is equal to the sum of squares of the other two sides. If the sides are a, b, and c (c = hypotenuse), then: c² = a² + b². Example: In a triangle with sides 3, 4, 5: 3² + 4² = 9 + 16 = 25 = 5². The converse is also true: if c² = a² + b², the triangle is right-angled.",
    stepByStep: [
      "Step 1: Given: Right triangle ABC with right angle at B. AB = a, BC = b, AC = c (hypotenuse).",
      "Step 2: Draw altitude BD from B to hypotenuse AC, meeting at D.",
      "Step 3: Triangles ABD and ABC are similar (AA similarity). So AB/AC = AD/AB → AB² = AC × AD.",
      "Step 4: Similarly, triangles BDC and ABC are similar. So BC/AC = DC/BC → BC² = AC × DC.",
      "Step 5: Adding: AB² + BC² = AC(AD + DC) = AC × AC = AC². Hence proved: a² + b² = c²."
    ],
    keyConcept: "The proof uses the concept of similar triangles. When an altitude is drawn from the right angle to the hypotenuse, it creates two triangles similar to each other and to the original triangle.",
    commonMistake: "The hypotenuse is always the LONGEST side, opposite the right angle. Students sometimes add the wrong sides. Remember: only the right angle's opposite side is the hypotenuse.",
    memoryTrick: "345 forever: 3² + 4² = 5² (9 + 16 = 25). Other Pythagorean triplets: 5-12-13, 8-15-17.",
    examTip: "In CBSE, the proof of Pythagoras theorem is a standard 4-5 mark question. Memorize the proof using altitude from right angle. Also know the converse and common Pythagorean triplets.",
    quizQuestion: "In a right triangle, if the two legs are 5 cm and 12 cm, what is the hypotenuse?",
    quizOptions: ["13 cm", "17 cm", "11 cm", "15 cm"],
    correctQuizOption: "13 cm",
    quizExplanation: "c² = 5² + 12² = 25 + 144 = 169. So c = √169 = 13 cm."
  }
];

export function findBestLocalMatch(
  question: string,
  classLevel: number,
  subject?: string,
  chapter?: string
): { question: LocalQuestion | null; score: number } {
  const normalizeStr = (s: string) => s.toLowerCase().trim();
  const questionLower = normalizeStr(question);
  const subjectLower = normalizeStr(subject ?? "");
  const chapterLower = normalizeStr(chapter ?? "");

  const questionKeywords = questionLower
    .split(/\s+/)
    .filter((w) => w.length > 3);

  let bestMatch: LocalQuestion | null = null;
  let bestScore = 0;

  for (const q of sampleQuestions) {
    let score = 0;

    // Class match (25 points)
    if (q.classLevel === classLevel) score += 25;

    // Keyword match in question — primary signal (up to 55 points)
    const storedQuestionLower = normalizeStr(q.question);
    const keywordMatches = questionKeywords.filter((kw) =>
      storedQuestionLower.includes(kw) || normalizeStr(q.bestAnswer).includes(kw)
    );
    if (questionKeywords.length > 0) {
      score += Math.min(55, Math.round((keywordMatches.length / questionKeywords.length) * 55));
    }

    // Subject bonus (up to 10 points) — only when supplied
    if (subjectLower) {
      if (normalizeStr(q.subject) === subjectLower) score += 10;
      else if (normalizeStr(q.subject).includes(subjectLower) || subjectLower.includes(normalizeStr(q.subject))) score += 6;
    }

    // Chapter bonus (up to 10 points) — only when supplied
    if (chapterLower) {
      const chapterWords = chapterLower.split(/\s+/).filter((w) => w.length > 3);
      const storedChapterWords = normalizeStr(q.chapter).split(/\s+/).filter((w) => w.length > 3);
      const chapterWordMatches = chapterWords.filter((w) => storedChapterWords.some((sw) => sw.includes(w) || w.includes(sw)));
      if (chapterWordMatches.length > 0) {
        score += Math.min(10, Math.round((chapterWordMatches.length / Math.max(chapterWords.length, 1)) * 10));
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = q;
    }
  }

  return { question: bestMatch, score: bestScore };
}
