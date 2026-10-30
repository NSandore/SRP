<?php

declare(strict_types=1);

/** @return array<string, string> */
function srp_info_board_study_abroad_content(): array {
    $passportGuide = <<<'HTML'
<p>A passport identifies the traveler and establishes nationality; a visa or electronic travel authorization is permission from a destination government to seek entry for a stated purpose. They are not interchangeable, and neither guarantees admission at a border. Requirements depend on citizenship, destination, transit countries, purpose, length of stay, and date.</p>

<h2>Check the exact travel route</h2>
<p>Review entry, exit, transit, passport-validity, blank-page, and visa rules for every country on the itinerary. Use the destination government or embassy as the controlling source. U.S. citizens can begin with State Department destination pages; other citizens should consult their own government and relevant consulates.</p>

<h2>Apply early</h2>
<p>Passport and visa processing times change. Begin before buying nonrefundable travel, and use official government channels or a clearly authorized program process. A host-school acceptance or provider letter may be required but does not replace the immigration application.</p>

<h2>Understand student status</h2>
<p>The required visa depends on program length, academic credit, work, internships, and host-country rules. Tourist or visa-free entry may prohibit study or work. Do not assume an unpaid internship is permitted. Follow the host institution and consulate’s written instructions.</p>

<h2>Protect documents</h2>
<p>Make secure copies, leave one with a trusted contact, and keep copies separate from originals. Do not post passport, visa, or government ID images. Know how to report loss or theft and contact your embassy or consulate. Carry required documents during travel rather than placing them in checked luggage.</p>

<h2>For international students in the U.S.</h2>
<p>Before leaving the United States for study abroad, consult the DSO or responsible officer about travel endorsement, visa validity, SEVIS status, time outside the country, and return documentation. Study-abroad participation does not automatically guarantee U.S. reentry.</p>

<h2>Final check</h2>
<p>Recheck requirements shortly before departure because policies, advisories, and airline document checks change. Verify names match across reservations and documents, review emergency contacts, and enroll in an appropriate traveler-registration service when available.</p>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://www.usa.gov/passport">USAGov: U.S. passports</a></li>
  <li><a href="https://travel.state.gov/en/international-travel/planning/checklist.html">State Department: international travel checklist</a></li>
  <li><a href="https://travel.state.gov/content/travel/en/us-visas/study/student-visa.html">State Department: U.S. student visas</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Current government rules for your nationality, route, and purpose control.</em></p>
HTML;

    return [
        'Study Abroad: Where to Start' => <<<'HTML'
<p>Start study-abroad planning with academic purpose, degree fit, total cost, safety, and accessibility—not only destination. Programs can be faculty-led, exchange, direct enrollment, provider-operated, internship-based, research-based, or virtual. Each structure changes credit, support, billing, housing, and risk.</p>

<h2>Define your goals and constraints</h2>
<p>Identify subject or language goals, preferred term, budget, graduation timeline, health and accessibility needs, citizenship and visa constraints, family responsibilities, and comfort with independence. A shorter program is not automatically cheaper per credit, and a popular location is not automatically the best academic match.</p>

<h2>Meet the home institution early</h2>
<p>Contact study abroad, academic advising, financial aid, accessibility, health, and international-student offices as relevant. Ask which programs are approved, how enrollment is recorded, what credit returns, which aid can apply, and which deadlines precede the program application.</p>

<h2>Compare program structures</h2>
<p>Review sponsor and host institution, course access, language level, calendar, housing, on-site staff, emergency support, excursions, internship authorization, refund and withdrawal terms, and student conduct rules. Ask who has authority during a crisis and what happens if a course or site changes.</p>

<h2>Research destination conditions</h2>
<p>Read current travel advisories, entry and visa rules, local laws, health guidance, attitudes affecting identity, transportation, communications, and banking. Consider disability access, medication restrictions, gender and LGBTQ+ safety, race and ethnicity, religion, and mental-health continuity without assuming one student’s experience is universal.</p>

<h2>Build a timeline</h2>
<p>Plan for application, passport, visa, course approvals, funding, health appointments, insurance, housing, flights, orientation, and emergency contacts. Avoid nonrefundable purchases until acceptance and entry requirements are sufficiently clear.</p>

<h2>Prepare for return</h2>
<p>Ask when the host transcript arrives, how grades convert, and whether delayed credit could affect prerequisites, graduation, aid, or registration. Plan reentry academically and emotionally, and save coursework needed for credit review.</p>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://travel.state.gov/en/international-travel/planning/safety-tips/studying.html">State Department: studying abroad</a></li>
  <li><a href="https://studyabroad.state.gov/">USA Study Abroad</a></li>
  <li><a href="https://travel.state.gov/en/international-travel/planning/checklist.html">State Department travel checklist</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Home-school, program, host-country, and destination rules control.</em></p>
HTML,

        'How Study Abroad Credits Work' => <<<'HTML'
<p>Study-abroad credit depends on the relationship among the home institution, host or provider, course approval, transcript, grades, and degree requirements. “Approved program” does not necessarily mean every course will satisfy the major. Obtain written preapproval before committing.</p>

<h2>Possible credit models</h2>
<p>A program may award home-institution credit directly, host-institution transfer credit, provider or school-of-record credit, or no academic credit. Grades may affect the institutional GPA, appear as pass/fail, or transfer without grades. The home institution controls its record and degree application.</p>

<h2>Preapprove courses and backups</h2>
<p>Submit syllabi, contact hours, level, language, assessment, and host credit value to the authorized department. Request specific equivalencies and degree requirements, not only elective acceptance. Preapprove alternate courses because schedules and enrollment can change on arrival.</p>

<h2>Account for conversion</h2>
<p>Host credits may use semester, quarter, ECTS, local units, or contact hours. The home school applies its conversion and rounding rules. A course can return with fewer credits than expected or at a different level, leaving a prerequisite or graduation shortfall.</p>

<h2>Enrollment and grades</h2>
<p>Confirm the course load required by the program, home school, aid, visa, and scholarships. Learn grading conversion, minimum grade, add/drop process, attendance rules, and whether retakes are possible. Do not assume a host pass meets a major’s minimum grade.</p>

<h2>After the program</h2>
<p>Arrange the official transcript and retain syllabi and completed work. Track receipt and review the degree audit. If the result differs from written preapproval, use the published appeal process promptly. Delays can affect registration, graduation, and aid.</p>

<h2>Questions before departure</h2>
<p>Who issues the transcript? How many credits and what equivalents are expected? Do grades affect GPA? Which catalog and major rules apply? What happens if a course is canceled? Who issues the final ruling?</p>

<hr><h2>Neutral sources</h2>
<ul>
  <li><a href="https://studyabroad.state.gov/">USA Study Abroad</a></li>
  <li><a href="https://nces.ed.gov/programs/coe/glossary">NCES academic terminology</a></li>
  <li><a href="https://travel.state.gov/en/international-travel/planning/safety-tips/studying.html">State Department: studying abroad</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Written home-institution approval and the final transcript evaluation control.</em></p>
HTML,

        'Paying for Study Abroad' => <<<'HTML'
<p>Compare study-abroad cost as a complete budget, not a program fee. Depending on the structure, you may pay home tuition, host tuition, a provider fee, or a combination. Financial aid may apply when the program is approved and administered through an eligible home institution, but the aid office must decide.</p>

<h2>Build the full budget</h2>
<p>Include tuition, program and home-school fees, housing, meals, passport, visa, airfare, local transportation, insurance, medical needs, phone, books, excursions, exchange-rate changes, deposits, and emergency travel. Separate required costs from optional travel.</p>

<h2>Confirm aid in writing</h2>
<p>Ask financial aid which federal, state, institutional, private, veterans, or employer benefits can apply; the required enrollment; cost-of-attendance adjustment; disbursement date; and documentation. Aid may arrive after deposits or flights are due. Never assume a prior award automatically follows the program.</p>

<h2>Scholarships and grants</h2>
<p>Search the home school, program, host, government exchanges, language and area-study programs, professional associations, and community organizations. Apply early and verify citizenship, field, destination, duration, and service conditions. A scholarship can affect need-based aid, so report it.</p>

<h2>Manage timing and currency risk</h2>
<p>Create a cash-flow calendar showing deposits, bill dates, aid disbursement, refunds, and travel purchases. Ask how cancellations, visa denial, emergencies, or program changes affect refunds. Use realistic exchange-rate cushions and understand card and ATM fees.</p>

<h2>Avoid unsafe financing</h2>
<p>Compare scholarships, savings, work, payment plans, federal loans when eligible, and private borrowing in that order of risk. Do not borrow based on an assumed future salary or rely on unauthorized work abroad. Verify scholarship and housing-payment requests independently.</p>

<h2>Before committing</h2>
<p>Obtain a written program budget, aid estimate, refund policy, credit plan, and emergency coverage. Compare the opportunity with a lower-cost term, exchange, faculty-led option, domestic alternative, or later timing.</p>

<hr><h2>Neutral sources</h2>
<ul>
  <li><a href="https://studyabroad.state.gov/">USA Study Abroad: opportunities and resources</a></li>
  <li><a href="https://studentaid.gov/articles/evaluating-financial-aid-offers/">Federal Student Aid: evaluating costs and aid</a></li>
  <li><a href="https://travel.state.gov/en/international-travel/planning/checklist.html">State Department travel checklist</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Your aid office and program’s written billing and refund terms control.</em></p>
HTML,

        'Passports & Visa Information' => $passportGuide,
        'Passports & Visas for Study Abroad' => $passportGuide,

        'Choosing a Study Abroad Program' => <<<'HTML'
<p>Choose a study-abroad program by comparing academic fit, credit certainty, support, safety, accessibility, total cost, and host-community engagement. The destination matters, but program structure often has more effect on learning and risk.</p>

<h2>Verify sponsorship and academics</h2>
<p>Identify the legal and academic sponsor, host institution, school of record, and transcript issuer. Confirm course availability, language, level, calendar, teaching and assessment, credit conversion, and written home-school approval. Marketing examples do not guarantee your courses.</p>

<h2>Compare support</h2>
<p>Ask about predeparture and on-site orientation, staff availability, emergency response, housing, health and mental-health care, accessibility, academic help, harassment reporting, and evacuation. Learn who supports independent travel and what assistance costs extra.</p>

<h2>Evaluate destination fit</h2>
<p>Review laws, health, travel advisories, political conditions, transportation, language, climate, and identity-related considerations. Ask how the program prepares students for local norms without stereotyping the host community.</p>

<h2>Read the finances and contract</h2>
<p>Compare the same cost categories across programs and determine what is included. Read deposit, withdrawal, refund, cancellation, conduct, housing, insurance, and force-majeure terms. Ask what happens if a visa is denied, a course changes, or the program relocates.</p>

<h2>Assess learning and ethics</h2>
<p>Look for sustained engagement, qualified supervision, language development, and respect for local partners. Be cautious with short-term volunteering, clinical contact, orphanage visits, or projects that students are not qualified to perform. Meaningful community partnership should not treat people as experiences.</p>

<h2>Decision checklist</h2>
<p>Can the program advance the degree? Is it affordable after confirmed aid? Are support and accessibility sufficient? Are documents and visa timing realistic? Are safety plans current? Can you explain why this structure and location fit better than alternatives? Keep written answers and compare them side by side before paying a nonrefundable deposit.</p>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://travel.state.gov/en/international-travel/planning/safety-tips/studying.html">State Department: studying abroad</a></li>
  <li><a href="https://studyabroad.state.gov/">USA Study Abroad</a></li>
  <li><a href="https://travel.state.gov/en/international-travel/planning/checklist.html">International travel checklist</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Verify academic approval, contract terms, destination rules, and current advisories.</em></p>
HTML,

        'Study Abroad Questions Megathread' => <<<'HTML'
<p>Use this megathread for general study-abroad questions and shared experience. Community members can help compare program structures and preparation, but cannot approve credit, award aid, issue travel documents, interpret individual immigration status, or guarantee safety.</p>

<h2>Share context safely</h2>
<p>Include the program type, broad destination, term, academic goal, and focused question. Do not post passport or visa numbers, itineraries with exact lodging, student IDs, medical records, financial documents, or unredacted program contracts.</p>

<h2>Good discussion topics</h2>
<p>Ask about questions to bring to providers, course registration, cultural adjustment, packing, budgeting categories, housing formats, accessibility planning, and returning to campus. Ask respondents to identify year and program type because conditions change.</p>

<h2>Official decisions</h2>
<p>Take credit and degree questions to the home registrar and department; aid questions to financial aid; health and accommodation questions to responsible offices; passport and visa questions to governments; and emergency questions to the program and relevant embassy or consulate.</p>

<h2>Community standards</h2>
<ul>
  <li>Do not guarantee credit, visas, entry, aid, or safety.</li>
  <li>Do not minimize travel advisories or local law.</li>
  <li>Do not request private documents or live location.</li>
  <li>Respect identity, disability, citizenship, family, and financial constraints.</li>
  <li>Distinguish current facts from personal experience.</li>
</ul>

<h2>Before acting</h2>
<p>Confirm written credit approval, aid, program terms, insurance, passport and visa requirements, health planning, and destination advisories. Recheck shortly before departure and keep emergency contacts.</p>

<h2>How to get a useful answer</h2>
<p>Ask one focused question at a time and say what you have already confirmed with your school or program. When sharing a past experience, include the year and make clear whether it is a personal example or a current rule. Rules can differ by destination, nationality, school, sponsor, and program model. If advice conflicts, pause before paying, booking, or changing enrollment and request a written answer from the office responsible for that decision.</p>

<hr><h2>Official starting points</h2>
<ul>
  <li><a href="https://travel.state.gov/en/international-travel/planning/safety-tips/studying.html">State Department: studying abroad</a></li>
  <li><a href="https://studyabroad.state.gov/">USA Study Abroad</a></li>
  <li><a href="https://travel.state.gov/en/international-travel/travel-advisories/smart-traveler-enrollment-program.html">Smart Traveler Enrollment Program</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Protect personal information and verify high-stakes advice officially.</em></p>
HTML,
    ];
}
