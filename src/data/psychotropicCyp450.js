// Exam-focused CYP450 synthesis for psychiatric board preparation.
// Last verified: 2026-09-20.
// Intentionally lists clinically meaningful pathways rather than every minor in-vitro route.
// Current regulatory cross-checks: FDA CYP interaction tables + current DailyMed labels.

export const psychotropicCyp450Rows = [
  // Antipsychotics
  { id: "cyp_clozapine", group: "Αντιψυχωσικά", drug: "Clozapine", metabolism: "CYP1A2 major; CYP3A4/2D6 minor", cypEffect: "—", pearl: "Κάπνισμα ↓ επίπεδα μέσω επαγωγής 1A2. Διακοπή καπνίσματος ή αναστολείς 1A2 μπορούν να ↑ σημαντικά τα επίπεδα." },
  { id: "cyp_olanzapine", group: "Αντιψυχωσικά", drug: "Olanzapine", metabolism: "CYP1A2 major; CYP2D6 minor + UGT", cypEffect: "—", pearl: "Κάπνισμα επάγει CYP1A2 → χαμηλότερη έκθεση. Η fluvoxamine μπορεί να ↑ τα επίπεδα." },
  { id: "cyp_risperidone", group: "Αντιψυχωσικά", drug: "Risperidone", metabolism: "CYP2D6 major; CYP3A4 minor", cypEffect: "—", pearl: "2D6 → 9-hydroxyrisperidone (paliperidone). Fluoxetine/paroxetine ↑ risperidone." },
  { id: "cyp_paliperidone", group: "Αντιψυχωσικά", drug: "Paliperidone", metabolism: "Ελάχιστος CYP — κυρίως νεφρική απέκκριση", cypEffect: "—", pearl: "High-yield εξαίρεση: πολύ λιγότερο ευάλωτη σε CYP αλληλεπιδράσεις από risperidone." },
  { id: "cyp_aripiprazole", group: "Αντιψυχωσικά", drug: "Aripiprazole", metabolism: "CYP2D6 + CYP3A4", cypEffect: "—", pearl: "Ισχυροί αναστολείς 2D6/3A4 ↑ επίπεδα· ισχυροί επαγωγείς 3A4 ↓ επίπεδα." },
  { id: "cyp_brexpiprazole", group: "Αντιψυχωσικά", drug: "Brexpiprazole", metabolism: "CYP2D6 + CYP3A4", cypEffect: "—", pearl: "Ίδιο βασικό μοτίβο με aripiprazole: προσοχή σε 2D6 inhibitors και 3A4 inhibitors/inducers." },
  { id: "cyp_cariprazine", group: "Αντιψυχωσικά", drug: "Cariprazine", metabolism: "CYP3A4 major; CYP2D6 minor", cypEffect: "—", pearl: "Μακράς διάρκειας ενεργοί μεταβολίτες· οι 3A4 αλληλεπιδράσεις μπορεί να έχουν παρατεταμένη κλινική επίδραση." },
  { id: "cyp_quetiapine", group: "Αντιψυχωσικά", drug: "Quetiapine", metabolism: "CYP3A4 major", cypEffect: "Κλινικά μη σημαντική CYP αναστολή", pearl: "Κλασικό 3A4 substrate: ισχυροί inhibitors ↑ πολύ την έκθεση, ισχυροί inducers ↓ έντονα." },
  { id: "cyp_lurasidone", group: "Αντιψυχωσικά", drug: "Lurasidone", metabolism: "CYP3A4 major", cypEffect: "—", pearl: "Ισχυροί CYP3A4 inhibitors και inducers αντενδείκνυνται." },
  { id: "cyp_ziprasidone", group: "Αντιψυχωσικά", drug: "Ziprasidone", metabolism: "Aldehyde oxidase major; CYP3A4 minor", cypEffect: "—", pearl: "Μην τη θυμάσαι ως «καθαρό 3A4». Το dominant pathway είναι aldehyde oxidase, άρα μικρότερη CYP εξάρτηση." },
  { id: "cyp_haloperidol", group: "Αντιψυχωσικά", drug: "Haloperidol", metabolism: "CYP3A4 + CYP2D6 + glucuronidation", cypEffect: "—", pearl: "Αναστολή 2D6/3A4 μπορεί να ↑ έκθεση· συνδύασε αυτό με τον κίνδυνο QT/EPS." },
  { id: "cyp_chlorpromazine", group: "Αντιψυχωσικά", drug: "Chlorpromazine", metabolism: "CYP2D6 important; 1A2/3A4 contributions", cypEffect: "Αναστέλλει CYP2D6 (κλινικά μέτρια σημασία)", pearl: "Λιγότερο «καθαρό» μονοένζυμο προφίλ από quetiapine/lurasidone." },
  { id: "cyp_amisulpride", group: "Αντιψυχωσικά", drug: "Amisulpride", metabolism: "Ελάχιστος CYP — κυρίως νεφρική απέκκριση", cypEffect: "—", pearl: "High-yield εξαίρεση μαζί με paliperidone: μικρή ηπατική CYP μεταβολική εξάρτηση." },

  // Antidepressants
  { id: "cyp_fluoxetine", group: "Αντικαταθλιπτικά", drug: "Fluoxetine", metabolism: "CYP2D6 major; 2C19/2C9/3A4 contributions", cypEffect: "Ισχυρός CYP2D6 inhibitor; κλινικά σημαντική 2C19 inhibition", pearl: "Μακρά ημιζωή + norfluoxetine → αλληλεπιδράσεις που επιμένουν μετά τη διακοπή." },
  { id: "cyp_paroxetine", group: "Αντικαταθλιπτικά", drug: "Paroxetine", metabolism: "CYP2D6 major", cypEffect: "Ισχυρός CYP2D6 inhibitor", pearl: "Κλασικός strong 2D6 inhibitor· μπορεί να προκαλέσει phenoconversion σε λειτουργικό poor metabolizer." },
  { id: "cyp_fluvoxamine", group: "Αντικαταθλιπτικά", drug: "Fluvoxamine", metabolism: "Πολλαπλά CYP pathways", cypEffect: "Ισχυρός CYP1A2 + CYP2C19 inhibitor; μέτριος CYP3A inhibitor", pearl: "Εξεταστικό must: fluvoxamine + clozapine = δυνητικά μεγάλη ↑ clozapine." },
  { id: "cyp_sertraline", group: "Αντικαταθλιπτικά", drug: "Sertraline", metabolism: "CYP2B6/2C19/2D6/3A4 (πολλαπλά)", cypEffect: "Ασθενής CYP2D6 inhibitor σε συνήθεις δόσεις", pearl: "Λιγότερο ισχυρή 2D6 αναστολή από fluoxetine/paroxetine." },
  { id: "cyp_citalopram", group: "Αντικαταθλιπτικά", drug: "Citalopram", metabolism: "CYP2C19 + CYP3A4 primary", cypEffect: "Ασθενής CYP inhibition", pearl: "CYP2C19 poor metabolizers ή 2C19 inhibitors ↑ έκθεση· θυμήσου τη συσχέτιση με QT-dose limits." },
  { id: "cyp_escitalopram", group: "Αντικαταθλιπτικά", drug: "Escitalopram", metabolism: "CYP2C19 major; CYP3A4/2D6 minor", cypEffect: "Μικρή κλινική CYP inhibition", pearl: "Το CYP2C19 είναι το φαρμακογενετικά πιο σημαντικό μονοπάτι." },
  { id: "cyp_venlafaxine", group: "Αντικαταθλιπτικά", drug: "Venlafaxine", metabolism: "CYP2D6 major → O-desmethylvenlafaxine; 3A4 minor", cypEffect: "—", pearl: "2D6 poor metabolizers έχουν ↑ parent / ↓ ODV· η συνολική active moiety αλλάζει λιγότερο." },
  { id: "cyp_desvenlafaxine", group: "Αντικαταθλιπτικά", drug: "Desvenlafaxine", metabolism: "UGT conjugation + renal; CYP3A4 minor", cypEffect: "—", pearl: "Πολύ λιγότερο εξαρτώμενη από CYP2D6 από venlafaxine." },
  { id: "cyp_duloxetine", group: "Αντικαταθλιπτικά", drug: "Duloxetine", metabolism: "CYP1A2 + CYP2D6", cypEffect: "Μέτριος CYP2D6 inhibitor", pearl: "Fluvoxamine/ciprofloxacin μπορούν να ↑ έκθεση μέσω 1A2 inhibition· αυξάνει desipramine μέσω 2D6 inhibition." },
  { id: "cyp_vortioxetine", group: "Αντικαταθλιπτικά", drug: "Vortioxetine", metabolism: "CYP2D6 major; 2C19/2C9/3A4 minor", cypEffect: "—", pearl: "Strong 2D6 inhibitors μπορούν να αυξήσουν σημαντικά την έκθεση." },
  { id: "cyp_bupropion", group: "Αντικαταθλιπτικά", drug: "Bupropion", metabolism: "CYP2B6 major", cypEffect: "Ισχυρός CYP2D6 inhibitor (κυρίως μέσω ενεργών μεταβολιτών)", pearl: "Κλασικό ζεύγος: 2B6 substrate αλλά 2D6 inhibitor." },
  { id: "cyp_mirtazapine", group: "Αντικαταθλιπτικά", drug: "Mirtazapine", metabolism: "CYP1A2 + CYP2D6 + CYP3A4", cypEffect: "—", pearl: "Πολυενζυμικό προφίλ — λιγότερο ευάλωτη σε μία μόνο CYP οδό." },
  { id: "cyp_trazodone", group: "Αντικαταθλιπτικά", drug: "Trazodone", metabolism: "CYP3A4 major", cypEffect: "—", pearl: "Ισχυροί 3A4 inhibitors ↑ trazodone· προσοχή σε καταστολή/ορθοστασία/QT." },
  { id: "cyp_agomelatine", group: "Αντικαταθλιπτικά", drug: "Agomelatine", metabolism: "CYP1A2 major; CYP2C9/2C19 minor", cypEffect: "—", pearl: "Ισχυρή 1A2 inhibition (π.χ. fluvoxamine) μπορεί να αυξήσει πολύ την έκθεση." },
  { id: "cyp_amitriptyline", group: "Αντικαταθλιπτικά", drug: "Amitriptyline", metabolism: "CYP2C19 → nortriptyline; CYP2D6 hydroxylation", cypEffect: "—", pearl: "Κλασικό TCA με διπλή σημασία 2C19 + 2D6." },
  { id: "cyp_nortriptyline", group: "Αντικαταθλιπτικά", drug: "Nortriptyline", metabolism: "CYP2D6 major", cypEffect: "—", pearl: "Desipramine/nortriptyline είναι κλασικά ευαίσθητα 2D6 substrates." },
  { id: "cyp_imipramine", group: "Αντικαταθλιπτικά", drug: "Imipramine", metabolism: "CYP2C19 → desipramine; CYP2D6 hydroxylation", cypEffect: "—", pearl: "Παρόμοιο exam pattern με amitriptyline." },
  { id: "cyp_desipramine", group: "Αντικαταθλιπτικά", drug: "Desipramine", metabolism: "CYP2D6 major", cypEffect: "—", pearl: "FDA index substrate για CYP2D6 — πολύ χρήσιμο μνημονικό." },
  { id: "cyp_clomipramine", group: "Αντικαταθλιπτικά", drug: "Clomipramine", metabolism: "CYP2C19/2D6 + CYP3A4", cypEffect: "—", pearl: "Προσοχή με strong 2D6/2C19 inhibitors λόγω τοξικότητας TCA." },

  // Mood stabilizers / anticonvulsants
  { id: "cyp_carbamazepine", group: "Σταθεροποιητές διάθεσης", drug: "Carbamazepine", metabolism: "CYP3A4 substrate; autoinduction", cypEffect: "Ισχυρός CYP3A4 inducer; επάγει επίσης 2B6/2C9/2C19 και UGT/P-gp", pearl: "Ένα από τα σημαντικότερα enzyme inducers στην ψυχιατρική. Μειώνει πολλά psychotropic levels." },
  { id: "cyp_valproate", group: "Σταθεροποιητές διάθεσης", drug: "Valproate", metabolism: "UGT + β-oxidation; CYP2C9 minor", cypEffect: "Αναστέλλει UGT και CYP2C9 σε κλινικά σχετικές αλληλεπιδράσεις", pearl: "Το μεγάλο exam interaction δεν είναι CYP: αναστέλλει glucuronidation της lamotrigine → ↑ lamotrigine." },
  { id: "cyp_lamotrigine", group: "Σταθεροποιητές διάθεσης", drug: "Lamotrigine", metabolism: "UGT1A4 glucuronidation — όχι σημαντικός CYP", cypEffect: "—", pearl: "Valproate ↓ clearance· carbamazepine/άλλοι UGT inducers ↑ clearance." },
  { id: "cyp_lithium", group: "Σταθεροποιητές διάθεσης", drug: "Lithium", metabolism: "Δεν μεταβολίζεται — νεφρική απέκκριση αμετάβλητο", cypEffect: "—", pearl: "High-yield non-CYP εξαίρεση. Αλληλεπιδράσεις μέσω νεφρικής κάθαρσης (NSAIDs, ACEi/ARB, thiazides)." },

  // ADHD / anxiolytics / sedatives / other high-yield
  { id: "cyp_atomoxetine", group: "ADHD & άλλα", drug: "Atomoxetine", metabolism: "CYP2D6 major", cypEffect: "—", pearl: "2D6 poor metabolizers: πολύ ↑ έκθεση· strong 2D6 inhibitors (fluoxetine/paroxetine) μιμούνται poor-metabolizer phenotype." },
  { id: "cyp_methylphenidate", group: "ADHD & άλλα", drug: "Methylphenidate", metabolism: "CES1 hydrolysis — όχι σημαντικός CYP", cypEffect: "—", pearl: "Μην το βάζεις μηχανικά στο CYP2D6 επειδή είναι stimulant." },
  { id: "cyp_amphetamine", group: "ADHD & άλλα", drug: "Amphetamine", metabolism: "Πολλαπλές οδοί; CYP2D6 συμμετέχει μερικώς", cypEffect: "—", pearl: "2D6 inhibitors μπορούν να ↑ έκθεση, αλλά το CYP2D6 δεν είναι η μοναδική οδός." },
  { id: "cyp_guanfacine", group: "ADHD & άλλα", drug: "Guanfacine", metabolism: "CYP3A4/5 major", cypEffect: "—", pearl: "3A4 inhibitors ↑, 3A4 inducers ↓ guanfacine." },
  { id: "cyp_diazepam", group: "ADHD & άλλα", drug: "Diazepam", metabolism: "CYP2C19 + CYP3A4", cypEffect: "—", pearl: "Σε αντίθεση με LOT benzodiazepines, εξαρτάται από CYP και έχει ενεργούς μεταβολίτες." },
  { id: "cyp_alprazolam", group: "ADHD & άλλα", drug: "Alprazolam", metabolism: "CYP3A4 major", cypEffect: "—", pearl: "Ισχυροί 3A4 inhibitors μπορούν να ↑ έντονα καταστολή/έκθεση." },
  { id: "cyp_clonazepam", group: "ADHD & άλλα", drug: "Clonazepam", metabolism: "CYP3A4 important", cypEffect: "—", pearl: "Πιο CYP-dependent από lorazepam/oxazepam/temazepam." },
  { id: "cyp_lorazepam", group: "ADHD & άλλα", drug: "Lorazepam", metabolism: "Glucuronidation — όχι σημαντικός CYP", cypEffect: "—", pearl: "LOT: Lorazepam, Oxazepam, Temazepam → phase II glucuronidation." },
  { id: "cyp_oxazepam", group: "ADHD & άλλα", drug: "Oxazepam", metabolism: "Glucuronidation — όχι σημαντικός CYP", cypEffect: "—", pearl: "LOT benzodiazepine; χρήσιμο σε ηπατική δυσλειτουργία επειδή αποφεύγει oxidative CYP metabolism." },
  { id: "cyp_temazepam", group: "ADHD & άλλα", drug: "Temazepam", metabolism: "Glucuronidation — όχι σημαντικός CYP", cypEffect: "—", pearl: "Τρίτο γράμμα του LOT mnemonic." },
  { id: "cyp_buspirone", group: "ADHD & άλλα", drug: "Buspirone", metabolism: "CYP3A4 major", cypEffect: "—", pearl: "3A4 inhibitors ↑, 3A4 inducers ↓ buspirone." },
  { id: "cyp_zolpidem", group: "ADHD & άλλα", drug: "Zolpidem", metabolism: "CYP3A4 major; 1A2/2C9 minor", cypEffect: "—", pearl: "Κυρίως 3A4 substrate." },
  { id: "cyp_donepezil", group: "ADHD & άλλα", drug: "Donepezil", metabolism: "CYP2D6 + CYP3A4", cypEffect: "—", pearl: "Κλινικά σχετικές CYP interactions είναι δυνατές, αν και όχι συνήθως το πρώτο exam pearl." },
  { id: "cyp_galantamine", group: "ADHD & άλλα", drug: "Galantamine", metabolism: "CYP2D6 + CYP3A4", cypEffect: "—", pearl: "Strong 2D6/3A4 inhibitors μπορούν να ↑ έκθεση." },
  { id: "cyp_rivastigmine", group: "ADHD & άλλα", drug: "Rivastigmine", metabolism: "Cholinesterase-mediated hydrolysis — ελάχιστος CYP", cypEffect: "—", pearl: "High-yield εξαίρεση μεταξύ cholinesterase inhibitors." },
  { id: "cyp_methadone", group: "ADHD & άλλα", drug: "Methadone", metabolism: "CYP2B6 major clinically; 3A4/2D6 contributions", cypEffect: "—", pearl: "Μην υπεραπλουστεύεις σε «3A4 drug»: το CYP2B6 είναι ιδιαίτερα σημαντικό για clearance." },
  { id: "cyp_buprenorphine", group: "ADHD & άλλα", drug: "Buprenorphine", metabolism: "CYP3A4 → norbuprenorphine + glucuronidation", cypEffect: "—", pearl: "Strong 3A4 inhibitors μπορούν να ↑ έκθεση." },
];

export const cyp450EnzymeSummary = [
  {
    enzyme: "CYP1A2",
    substrates: "Clozapine, olanzapine, duloxetine, agomelatine",
    inhibitors: "Fluvoxamine (ισχυρός). Επίσης ciprofloxacin ως πολύ σημαντικός μη ψυχιατρικός inhibitor.",
    inducers: "Κάπνισμα καπνού (όχι η νικοτίνη)· carbamazepine μπορεί να συμβάλει σε broad induction.",
    pearl: "Smoking cessation → γρήγορη άνοδος clozapine/olanzapine exposure. Ρώτα πάντα για αλλαγή στο κάπνισμα.",
  },
  {
    enzyme: "CYP2B6",
    substrates: "Bupropion, methadone",
    inhibitors: "Λιγότερο exam-heavy από 1A2/2D6/3A4.",
    inducers: "Carbamazepine, phenytoin, rifampin",
    pearl: "Bupropion = 2B6 substrate αλλά 2D6 inhibitor.",
  },
  {
    enzyme: "CYP2C19",
    substrates: "Citalopram/escitalopram, diazepam, amitriptyline, imipramine, clomipramine",
    inhibitors: "Fluvoxamine (ισχυρός); fluoxetine clinically relevant. Omeprazole/fluconazole είναι συχνοί μη ψυχιατρικοί inhibitors.",
    inducers: "Rifampin; carbamazepine",
    pearl: "CYP2C19 phenotype έχει ιδιαίτερη σημασία για citalopram/escitalopram και αρκετά TCAs.",
  },
  {
    enzyme: "CYP2D6",
    substrates: "Risperidone, aripiprazole/brexpiprazole, venlafaxine, TCAs, vortioxetine, atomoxetine",
    inhibitors: "Fluoxetine, paroxetine, bupropion = ισχυροί· duloxetine = μέτριος",
    inducers: "Κλινικά δεν υπάρχουν κλασικοί ισχυροί CYP2D6 inducers που να απομνημονεύονται όπως στο 3A4.",
    pearl: "Phenoconversion: strong 2D6 inhibitor μπορεί να κάνει έναν normal metabolizer να συμπεριφέρεται σαν poor metabolizer.",
  },
  {
    enzyme: "CYP2C9",
    substrates: "Μικρότερος ρόλος στα περισσότερα ψυχιατρικά φάρμακα· agomelatine/valproate έχουν σχετική συμμετοχή",
    inhibitors: "Valproate μπορεί να αναστείλει 2C9. Fluconazole = σημαντικός μη ψυχιατρικός inhibitor.",
    inducers: "Carbamazepine, phenytoin, rifampin",
    pearl: "Για εξετάσεις είναι συνήθως λιγότερο κεντρικό από 1A2, 2C19, 2D6 και 3A4.",
  },
  {
    enzyme: "CYP3A4/5",
    substrates: "Quetiapine, lurasidone, cariprazine, aripiprazole, brexpiprazole, trazodone, buspirone, alprazolam, guanfacine, buprenorphine",
    inhibitors: "Ισχυροί: azoles, clarithromycin, ritonavir/cobicistat. Fluvoxamine έχει μέτρια 3A inhibition.",
    inducers: "Carbamazepine, phenytoin, rifampin, St John's wort",
    pearl: "Το πιο συχνό «interaction enzyme». Lurasidone και quetiapine είναι ιδιαίτερα καθαρά exam examples.",
  },
];

export const cyp450Meta = {
  lastVerified: "20/09/2026",
  scopeNote: "Κύριες/κλινικά σημαντικές οδοί. Δεν επιχειρείται εξαντλητική καταγραφή όλων των minor in-vitro CYP pathways.",
  sourceNote: "Διασταύρωση με FDA CYP interaction tables και τρέχοντα DailyMed prescribing labels.",
};
