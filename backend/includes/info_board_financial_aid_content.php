<?php

declare(strict_types=1);

/**
 * Institution-neutral financial-aid guides for the Information Board.
 *
 * Federal rules and source links were reviewed on August 16, 2026. Schools,
 * states, tribes, territories, and scholarship providers may impose additional
 * requirements and earlier deadlines.
 *
 * @return array<string, string>
 */
function srp_info_board_financial_aid_content(): array {
    return [
        'FAFSA: Complete Beginner\'s Guide' => <<<'HTML'
<p>The <strong>Free Application for Federal Student Aid (FAFSA)</strong> is the free federal form used to determine eligibility for federal grants, work-study, and student loans. States, institutions, and some scholarship providers also use FAFSA information. Filing does not obligate you to borrow, and students should file even when they think their income is too high.</p>

<blockquote><strong>Use only <a href="https://studentaid.gov/">StudentAid.gov</a> or FAFSA.gov.</strong> Filing is free. School and state priority deadlines can be much earlier than the federal deadline, and limited funds may run out.</blockquote>

<h2>Choose the correct award year</h2>
<p>An award year runs from July 1 through June 30 and has its own FAFSA. Choose the form covering the academic period you will attend. Summer can belong to either the ending or beginning award year depending on the institution, so ask the financial aid office which FAFSA it uses.</p>

<h2>Create individual StudentAid.gov accounts</h2>
<p>The student and every required contributor need separate accounts and must not share credentials. A contributor may be the student, the student’s spouse, a biological or adoptive parent, or a parent’s spouse. Being a contributor does not make someone responsible for the student’s bill or loans.</p>
<p>Dependent students should use the official “Who’s My FAFSA Parent?” guidance for divorced, separated, remarried, or unmarried parents. A contributor without a Social Security number can create an account and complete a required section under the current process.</p>

<h2>Gather information</h2>
<ul>
  <li>legal names, birth dates, contact details, and identifying information;</li>
  <li>the student’s eligible citizenship information and A-Number when applicable;</li>
  <li>federal tax information for the required prior-prior tax year;</li>
  <li>current cash, savings, investments, businesses, farms, or other reportable assets;</li>
  <li>child support and other requested financial information;</li>
  <li>the schools that should receive FAFSA information.</li>
</ul>
<p>Answer for the dates and definitions stated on the form. Do not substitute tax, household, or dependency assumptions from another program.</p>

<h2>Complete, consent, sign, and submit</h2>
<p>Each contributor completes only their assigned section, provides required consent and approval for federal tax information, and signs with their own account. Review names, dates, marital status, dependency answers, and school selections carefully. The form is not fully submitted until all required sections and signatures are complete.</p>

<h2>After submission</h2>
<p>Monitor the form status and read the FAFSA Submission Summary. Resolve rejected items, missing signatures, identity or citizenship matches, verification requests, and school follow-up promptly. The summary includes the official Student Aid Index and federal eligibility information, but it is not an aid offer.</p>
<p>Each school determines an aid package after admission and receipt of required documents. Respond only through verified school portals and official contact channels.</p>

<h2>Corrections and special circumstances</h2>
<p>Correct errors through StudentAid.gov or the school as instructed. If current finances differ substantially from the tax year because of job loss, income reduction, divorce, death, unusual medical costs, or another qualifying circumstance, submit the FAFSA accurately first and ask the financial aid office about a professional-judgment review. Approval is not automatic.</p>

<h2>Annual checklist</h2>
<ol>
  <li>Create or recover accounts before the form opens.</li>
  <li>Check federal, state, school, and scholarship deadlines.</li>
  <li>Submit as early as practical and save confirmation.</li>
  <li>Review the Submission Summary and complete verification.</li>
  <li>Compare written aid offers by net price and borrowing.</li>
  <li>Accept only the aid you need.</li>
  <li>File a new FAFSA every award year.</li>
</ol>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://studentaid.gov/articles/fafsa-student-steps/">Federal Student Aid: 2026–27 student FAFSA steps</a></li>
  <li><a href="https://studentaid.gov/articles/things-you-need-for-fafsa/">Federal Student Aid: FAFSA checklist</a></li>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/application-and-verification-guide/ch1-application-process-fafsa-isir">2026–27 FSA Handbook: FAFSA application process</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Use the form, deadlines, and instructions for your exact award year.</em></p>
HTML,

        'Grants vs. Scholarships vs. Loans' => <<<'HTML'
<p>Grants, scholarships, and loans can all appear as “financial aid,” but they have very different costs and obligations. <strong>Grants and scholarships</strong> usually do not require repayment when all conditions are met. <strong>Loans</strong> are borrowed money that must generally be repaid with interest.</p>

<h2>Grants</h2>
<p>Grants are commonly based on financial need, program, service, or student characteristics. Sources include federal and state governments, tribes, institutions, and private organizations. Examples include the Federal Pell Grant and campus-based grants.</p>
<p>A grant can require repayment in some situations, such as withdrawing early, receiving an overaward, failing a service obligation, or becoming ineligible. Read renewal, enrollment, attendance, and satisfactory-progress rules.</p>

<h2>Scholarships</h2>
<p>Scholarships may consider academic achievement, talent, service, field, identity, location, employment, financial need, or other criteria. They can be renewable or one time, restricted to particular charges, and subject to GPA, credit-load, participation, or application requirements.</p>
<p>External scholarships may change an existing aid package. Tell the school as required and ask whether the scholarship reduces unmet need, loans, work-study, or institutional grants.</p>

<h2>Loans</h2>
<p>Loans create a legal repayment obligation. Compare borrower, principal, interest rate, origination fee, when interest begins, repayment options, protections, and total projected cost. Federal student loans generally offer protections not required of private loans.</p>
<p>A Parent PLUS loan belongs to the parent borrower, not the student. A private loan may require a cosigner who becomes legally responsible. Never treat a loan as a discount from price.</p>

<h2>Work-study is different</h2>
<p>Federal Work-Study is earned wages, not an upfront grant. An award is usually an eligibility and earnings ceiling; the student must obtain a job, work hours, and receive pay. Do not subtract the full work-study offer from the bill unless the school specifically applies earned wages that way.</p>

<h2>Recommended acceptance order</h2>
<ol>
  <li>Grants and scholarships whose conditions you can meet.</li>
  <li>Savings, current income, employer benefits, and affordable payment plans.</li>
  <li>Work-study or other manageable employment.</li>
  <li>Direct Subsidized Loans.</li>
  <li>Direct Unsubsidized Loans.</li>
  <li>Parent or private borrowing only after comparing obligations and total cost.</li>
</ol>

<h2>Compare net price correctly</h2>
<p>Start with the full cost of attendance, then subtract grants and scholarships. This produces a better affordability estimate than subtracting every line labeled “aid.” Keep loans and work-study in separate columns. Include renewal assumptions and expected price increases for later years.</p>

<h2>Questions for every award</h2>
<ul>
  <li>Must it be repaid, and under what circumstances?</li>
  <li>Is it renewable, and what are the requirements?</li>
  <li>Is it restricted to tuition or another cost?</li>
  <li>Will outside aid change other awards?</li>
  <li>Who is the borrower and what is the total repayment estimate?</li>
</ul>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://studentaid.gov/understand-aid/types">Federal Student Aid: types of aid</a></li>
  <li><a href="https://studentaid.gov/articles/evaluating-financial-aid-offers">Federal Student Aid: evaluating aid offers</a></li>
  <li><a href="https://studentaid.gov/sites/default/files/loan-entrance-counseling-color.pdf">Federal Student Aid: loan entrance counseling guide</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Confirm each award’s current terms with its provider and your financial aid office.</em></p>
HTML,

        'Federal Student Loans Explained' => <<<'HTML'
<p>Federal student loans are education loans authorized by the U.S. government. Most students borrow through the William D. Ford Federal Direct Loan Program. A loan can make education possible, but it is not free aid: the borrower signs a promissory note and must repay principal, interest, and applicable fees.</p>

<h2>Main Direct Loan types</h2>
<ul>
  <li><strong>Direct Subsidized:</strong> for eligible undergraduates with financial need; the government generally covers interest during specified periods.</li>
  <li><strong>Direct Unsubsidized:</strong> for eligible undergraduate, graduate, and professional students; interest generally accrues from disbursement.</li>
  <li><strong>Parent PLUS:</strong> borrowed by an eligible parent for a dependent undergraduate; the parent owes the debt.</li>
  <li><strong>Graduate PLUS:</strong> beginning July 1, 2026, new Grad PLUS borrowing ended except for borrowers who meet a limited transition exception.</li>
</ul>

<h2>How students receive a loan</h2>
<p>Complete the FAFSA, receive an aid offer, accept only the desired amount, complete required entrance counseling, and sign a Master Promissory Note. The school confirms eligibility, enrollment, cost of attendance, other aid, annual limits, and program rules before disbursement.</p>

<h2>Limits and 2026 changes</h2>
<p>Annual limits depend on level, dependency, year in school, enrollment, cost, and prior borrowing. Beginning with qualifying loan periods on or after July 1, 2026, new federal limits and less-than-full-time proration rules apply to many borrowers. New Parent PLUS annual and aggregate caps apply unless a transition exception is met. Graduate and professional classifications now produce different unsubsidized limits.</p>
<p>Do not copy a loan limit from an old article. Ask the school for the limit applicable to your program, enrollment, prior borrowing, and exception status.</p>

<h2>Interest, fees, and disbursement</h2>
<p>Federal rates are fixed for each loan after it is made, but new rates are set by loan type and disbursement year. An origination fee can be deducted before funds reach the school, so the amount credited may be less than the amount borrowed. Interest rules differ by loan type and status.</p>

<h2>Federal versus private loans</h2>
<p>Federal loans generally do not require undergraduate student credit underwriting or a cosigner and may offer federal repayment, deferment, discharge, and forgiveness protections. Private loans use lender contracts, may require credit or a cosigner, and can have variable rates or fewer protections. Compare federal options first.</p>

<h2>Borrow deliberately</h2>
<p>Review the balance on StudentAid.gov, estimate the payment under current plans, and compare it with conservative expected earnings. Reduce borrowing through grants, scholarships, lower-cost course plans, paid work, or living-cost changes when those options are realistic and safe.</p>

<h2>Before accepting</h2>
<ol>
  <li>Confirm the exact loan type and borrower.</li>
  <li>Check the interest rate and fee for that disbursement year.</li>
  <li>Borrow only the gap you actually need.</li>
  <li>Understand enrollment requirements and cancellation rights.</li>
  <li>Keep servicer and contact information current.</li>
  <li>Repeat the review each year; loans are not automatically identical.</li>
</ol>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://studentaid.gov/understand-aid/types/loans">Federal Student Aid: federal loan types</a></li>
  <li><a href="https://fsapartners.ed.gov/sites/default/files/2026-05/FrequentlyAskedQuestionsLoanLimits.pdf">Federal Student Aid: loan limits effective July 1, 2026</a></li>
  <li><a href="https://studentaid.gov/plus-loan-credit-counseling">Federal Student Aid: current PLUS changes and counseling</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Loan rules depend on disbursement date, program, enrollment, and transition eligibility.</em></p>
HTML,

        'Subsidized vs. Unsubsidized Loans' => <<<'HTML'
<p>Direct Subsidized and Direct Unsubsidized Loans are federal student loans, but they differ mainly in <strong>who is eligible and who pays interest during certain periods</strong>. Both are real debts, may carry an origination fee, and count toward annual and aggregate borrowing limits.</p>

<h2>Direct Subsidized Loans</h2>
<p>These are available to eligible undergraduate students who demonstrate financial need. The federal government generally pays the interest while the borrower is enrolled at least half time, during the six-month grace period, and during qualifying deferment periods. Exact treatment follows the loan’s terms and current law.</p>

<h2>Direct Unsubsidized Loans</h2>
<p>These are available to eligible undergraduates and graduate or professional students without a financial-need requirement for the loan itself. Interest begins accruing when the loan is disbursed. The borrower may pay interest while in school or allow it to remain outstanding; unpaid interest can increase total cost and may capitalize when permitted.</p>

<h2>What is the same</h2>
<ul>
  <li>FAFSA and school certification are generally required.</li>
  <li>The rate is fixed for the life of each loan once made.</li>
  <li>Borrowers sign a promissory note and complete counseling when required.</li>
  <li>Both generally have a six-month grace period after leaving school or dropping below half time.</li>
  <li>Both may qualify for applicable federal repayment, forgiveness, and discharge programs.</li>
</ul>

<h2>How much can you borrow?</h2>
<p>The aid offer may combine subsidized and unsubsidized amounts within one annual limit. Subsidized eligibility is limited by financial need and undergraduate rules. A student who does not qualify for the full subsidized amount may receive more of the combined limit as unsubsidized, but the school cannot exceed applicable limits, cost, or other eligibility rules.</p>

<h2>Why interest timing matters</h2>
<p>Two loans with the same principal and rate can cost different amounts if interest accrues for different periods. Ask for an estimate through graduation and repayment, not only the monthly payment. Small voluntary interest payments during school can reduce cost, but students should first protect essentials and emergency stability.</p>

<h2>Which should you accept first?</h2>
<p>After grants, scholarships, and earned resources, accept subsidized eligibility before unsubsidized borrowing because its interest benefit usually lowers cost. You may accept less than offered, request a later permitted increase through the school, or return/cancel funds under applicable timing rules.</p>

<h2>Common mistakes</h2>
<ul>
  <li>believing “unsubsidized” means privately issued;</li>
  <li>assuming no payments means no interest;</li>
  <li>accepting the full offer automatically;</li>
  <li>confusing the amount borrowed with the smaller amount received after fees;</li>
  <li>ignoring enrollment changes that trigger repayment.</li>
</ul>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://studentaid.gov/articles/subsidized-vs-unsubsidized-loans/">Federal Student Aid: subsidized versus unsubsidized loans</a></li>
  <li><a href="https://studentaid.gov/understand-aid/types/loans/subsidized-unsubsidized">Federal Student Aid: Direct Loan terms</a></li>
  <li><a href="https://studentaid.gov/sites/default/files/loan-entrance-counseling-color.pdf">Federal Student Aid: entrance counseling</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Review the promissory note and disclosure for each loan.</em></p>
HTML,

        'Understanding Your Financial Aid Award Letter' => <<<'HTML'
<p>A financial aid award letter—often called an <strong>aid offer</strong>—shows the grants, scholarships, work-study, and loans a school is offering for a stated period. It is not the same as a bill, and schools may use different layouts and terminology.</p>

<h2>Confirm the basics</h2>
<p>Check the student, institution, campus, program, residency classification, living arrangement, enrollment assumption, and award year. A package based on full-time on-campus attendance can change if you attend part time or live elsewhere.</p>

<h2>Separate price from aid</h2>
<p>Identify direct charges billed by the school—tuition, mandatory fees, and institution-billed housing or food—and indirect estimates such as books, transportation, supplies, and personal expenses. Cost of attendance is a planning budget and aid ceiling, not necessarily the exact bill.</p>
<p>Calculate <strong>net price</strong> as cost of attendance minus grants and scholarships. Keep loans and work-study separate because loans must be repaid and work-study must be earned.</p>

<h2>Classify every line</h2>
<ul>
  <li><strong>Grant/scholarship:</strong> usually gift aid, subject to conditions.</li>
  <li><strong>Work-study:</strong> potential wages after obtaining and working a job.</li>
  <li><strong>Subsidized loan:</strong> student debt with an interest subsidy during specified periods.</li>
  <li><strong>Unsubsidized loan:</strong> student debt accruing interest from disbursement.</li>
  <li><strong>Parent PLUS/private loan:</strong> borrowing that may appear as an option rather than confirmed aid.</li>
</ul>

<h2>Read the conditions</h2>
<p>Check whether awards are estimated, pending, one time, renewable, or already accepted. Note GPA, satisfactory-progress, credit-load, housing, major, residency, service, thank-you letter, verification, and deadline requirements. Ask whether tuition and aid are expected to change in later years.</p>

<h2>Calculate the actual gap</h2>
<p>Subtract gift aid from costs, then subtract realistic savings and current income. Add only work-study earnings you can reasonably obtain and schedule. Decide how much federal student loan to accept. Any remaining gap must be covered through a payment plan, lower costs, additional aid, work, borrowing, or a different enrollment choice.</p>

<h2>Compare schools consistently</h2>
<p>Create one table using the same categories for every school. Compare four-year or full-program estimates, not just first-year discounts. Separate the student’s debt from parent debt. Compare graduation rates, likely time to degree, program access, and travel or relocation costs.</p>

<h2>When to request reconsideration</h2>
<p>Contact the financial aid office when the offer contains an error, current finances changed substantially, unusual expenses exist, another school provided a materially different offer, or the package leaves an unexplained gap. Provide documentation and ask about the institution’s professional-judgment or appeal process. A review does not guarantee more aid.</p>

<h2>Questions to ask</h2>
<ul>
  <li>Which amounts are grants, earned wages, student loans, and parent loans?</li>
  <li>What will appear on the first bill, and when?</li>
  <li>What must I accept or complete?</li>
  <li>Which awards renew, and under what conditions?</li>
  <li>How does outside scholarship aid change this package?</li>
  <li>What is the estimated total borrowing through graduation?</li>
</ul>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://studentaid.gov/articles/evaluating-financial-aid-offers">Federal Student Aid: evaluate aid offers</a></li>
  <li><a href="https://studentaid.gov/aid-offer/">Federal Student Aid: aid-offer comparison information</a></li>
  <li><a href="https://nces.ed.gov/collegenavigator/">College Navigator: costs and outcomes</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. The school’s final written offer and student-account bill control.</em></p>
HTML,

        'Understanding the Student Aid Index' => <<<'HTML'
<p>The <strong>Student Aid Index (SAI)</strong> is a number calculated from FAFSA information under a federal formula. Schools use it with cost of attendance and other assistance to evaluate need for certain aid. It is not a bill, an award, a credit score, or the amount a family is required to pay.</p>

<h2>Where the SAI comes from</h2>
<p>The FAFSA Processing System uses student and contributor information and, in most cases, federal tax information transferred from the IRS. The formula considers income, some assets, family size, dependency status, and other statutory elements. For 2026–27, certain family businesses, principal-residence farms, and commercial fishing businesses are excluded under updated rules when requirements are met.</p>

<h2>What the number means</h2>
<p>SAI can range below zero, with a minimum of −1500, and can be positive. A lower SAI generally indicates greater calculated financial need, but it does not guarantee a particular award. Schools calculate need using cost of attendance minus SAI minus other financial assistance, subject to program rules and available funds.</p>

<h2>SAI and Pell Grants</h2>
<p>Pell eligibility is not based on SAI alone. Students may qualify through maximum, minimum, or calculated Pell pathways. Beginning in 2026–27, an SAI at or above twice the maximum Pell award generally makes a student ineligible for Pell, except for the statutory Special Rule. The official FAFSA result includes Pell indicators the school must apply with enrollment, cost, and lifetime eligibility.</p>

<h2>Why two schools offer different aid</h2>
<p>The SAI can be the same while costs, institutional grants, state aid, campus-based funds, scholarship policies, enrollment, and packaging practices differ. A higher-cost school may show more calculated need but still leave a larger net price.</p>

<h2>Errors and changes</h2>
<p>Review the FAFSA Submission Summary for incorrect income, assets, family information, citizenship, or dependency answers. Correct factual errors. Do not change accurate FAFSA data merely because the result is unfavorable.</p>
<p>If current circumstances differ substantially from the tax year, ask the school about professional judgment. The institution may review documented income loss or unusual expenses but is not required to reach the same decision as another school.</p>

<h2>What SAI does not include</h2>
<ul>
  <li>a promise that the family can pay that amount;</li>
  <li>every household expense or debt;</li>
  <li>the final amount of state, institutional, or private aid;</li>
  <li>the exact student-account bill;</li>
  <li>a judgment of financial responsibility.</li>
</ul>

<h2>Use it productively</h2>
<ol>
  <li>Confirm the SAI is official and the FAFSA is complete.</li>
  <li>Correct errors and complete verification.</li>
  <li>Compare each school’s gift aid and net price.</li>
  <li>Request a documented review when circumstances qualify.</li>
  <li>Refile annually because inputs and rules can change.</li>
</ol>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/application-and-verification-guide/ch3-student-aid-index-sai-and-pell-grant-eligibility">2026–27 FSA Handbook: SAI and Pell eligibility</a></li>
  <li><a href="https://studentaid.gov/sites/default/files/sai-explained.pdf">Federal Student Aid: SAI explained</a></li>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol1/ch1-school-determined-requirements">2026–27 FSA Handbook: need formula and SAI changes</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Use the official result and current-year rules.</em></p>
HTML,

        'When Does Financial Aid Get Disbursed?' => <<<'HTML'
<p><strong>Disbursement</strong> is when aid funds are paid to the student’s institutional account or, in limited cases, directly to the student or parent. An award appearing in a portal is not necessarily disbursed. Timing depends on the aid source, term, eligibility, enrollment, and school calendar.</p>

<h2>The usual sequence</h2>
<ol>
  <li>The student completes applications and required documents.</li>
  <li>The school offers aid and the student accepts required items.</li>
  <li>Enrollment and eligibility are confirmed.</li>
  <li>Funds are disbursed for the payment period.</li>
  <li>The school applies funds to allowable charges.</li>
  <li>Any eligible credit balance is released under applicable rules.</li>
</ol>

<h2>Why dates differ</h2>
<p>Semester, quarter, module, clock-hour, and nonterm programs use different payment periods. First-time, first-year loan borrowers and certain programs can have delayed loan timing. Scholarships, state grants, private loans, and employer benefits follow their own schedules.</p>

<h2>Requirements that can hold aid</h2>
<ul>
  <li>missing verification or conflicting information;</li>
  <li>unsigned loan documents or incomplete counseling;</li>
  <li>enrollment below the required level;</li>
  <li>courses not applying to the eligible program;</li>
  <li>citizenship, identity, default, or satisfactory-progress issues;</li>
  <li>unresolved admissions, transfer, or attendance records.</li>
</ul>

<h2>Aid can change after disbursement</h2>
<p>Adding, dropping, never attending, or withdrawing from classes can trigger recalculation. Outside scholarships, corrections, verification, academic progress, or a change in housing or residency may also alter aid. Do not spend a credit balance until enrollment and charges are stable.</p>

<h2>Federal credit-balance timing</h2>
<p>When federal Title IV aid credited to the account exceeds allowable charges, the school generally must pay the credit balance as soon as possible and no later than 14 days after it is created, or 14 days after classes begin if it existed earlier, unless a valid authorization or special rule applies. A school “refund” schedule may use different terminology.</p>

<h2>How to plan before funds arrive</h2>
<p>Ask for the scheduled disbursement date, expected account-posting date, and credit-balance delivery method. Confirm direct-deposit information through the official portal. Budget books, rent, transportation, and food for the gap between the start of the term and actual availability.</p>

<h2>If aid is late</h2>
<ol>
  <li>Check the portal for holds and outstanding requirements.</li>
  <li>Confirm enrollment and attendance reporting.</li>
  <li>Ask financial aid whether funds were authorized.</li>
  <li>Ask student accounts whether funds posted and whether a credit balance exists.</li>
  <li>Contact the aid provider for an external scholarship or private loan.</li>
  <li>Ask about emergency grants, book advances, or short-term support when necessary.</li>
</ol>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol4/ch2-disbursing-title-iv-funds">2026–27 FSA Handbook: disbursement and credit balances</a></li>
  <li><a href="https://studentaid.gov/complete-aid-process/receive-aid">Federal Student Aid: receiving aid</a></li>
  <li><a href="https://studentaid.gov/sites/default/files/MasterPromissoryNoteMPNDirectSubsidizedLoansandDirectUnsubsidizedLoans-en-us.pdf">Federal Direct Loan promissory note</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Ask your school for its exact calendar and outstanding requirements.</em></p>
HTML,

        'What Is a Financial Aid Refund?' => <<<'HTML'
<p>A <strong>financial aid refund</strong> is the common school term for money released after aid and other payments credited to the student account exceed eligible charges. Federal rules call the federal portion a <strong>Title IV credit balance</strong>. It is not bonus money and may include loans that must be repaid.</p>

<h2>How a credit balance is created</h2>
<p>If grants, scholarships, and loans credited for a term exceed tuition, fees, and other authorized charges, the account can show a credit. The school pays the eligible balance to the student, or sometimes to a parent when Parent PLUS funds created the balance.</p>

<h2>What it is meant to cover</h2>
<p>Funds may support education costs included in cost of attendance, such as books, supplies, required equipment, housing, food, transportation, child care when included, and other authorized expenses. Keep records and follow restrictions imposed by a scholarship, grant, benefit, or loan.</p>

<h2>Loans change the meaning</h2>
<p>A $2,000 payment to your bank account may be borrowed money with interest and fees. Review the account ledger to identify which funds produced the balance. If you do not need all loan proceeds, ask how to cancel or return part promptly; special cancellation rules may reduce interest and fees.</p>

<h2>Timing and delivery</h2>
<p>For a Title IV credit balance, schools generally must pay within 14 days after the balance is created, or within 14 days after the first day of class when the balance existed earlier, unless an authorized hold or another rule applies. Payment may be by electronic transfer, check, or another permitted method.</p>

<h2>Why the amount can change</h2>
<p>Enrollment changes, nonattendance, withdrawal, verification, outside aid, housing changes, returned purchases, or new charges can recalculate the account. A student can receive a refund and later owe the school because aid was reduced or returned.</p>

<h2>A safe spending plan</h2>
<ol>
  <li>Download the account ledger and identify grants, loans, payments, and charges.</li>
  <li>Confirm enrollment and attendance are final.</li>
  <li>Reserve money for books, rent, food, transportation, and later-term necessities.</li>
  <li>Do not treat the balance as monthly income beyond the covered period.</li>
  <li>Return unneeded loan funds when appropriate.</li>
  <li>Keep an emergency cushion in case aid changes.</li>
</ol>

<h2>Refund versus institutional refund policy</h2>
<p>A Title IV credit balance is different from a tuition refund under the school’s withdrawal or course-drop policy. It is also different from a post-withdrawal disbursement. Ask student accounts and financial aid which calculation produced a payment.</p>

<h2>If something looks wrong</h2>
<p>Do not spend an unexpected deposit. Verify the sender using the official portal, review new charges, and contact student accounts. Never provide login or banking credentials in response to an unsolicited “refund” email or text.</p>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol4/ch2-disbursing-title-iv-funds">2026–27 FSA Handbook: credit balances and payment timing</a></li>
  <li><a href="https://studentaid.gov/complete-aid-process/receive-aid">Federal Student Aid: receiving aid</a></li>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol5/ch1-general-requirements-withdrawals-and-return-title-iv-funds">2026–27 FSA Handbook: credit balances after withdrawal</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. The student-account ledger and aid office determine the actual source and amount.</em></p>
HTML,

        'How Federal Work-Study Works' => <<<'HTML'
<p><strong>Federal Work-Study (FWS)</strong> provides part-time employment to eligible students with financial need at participating institutions. A work-study amount in an aid offer is usually the maximum the student may earn through an eligible job—it is not a grant placed automatically on the tuition bill.</p>

<h2>How eligibility is determined</h2>
<p>Students complete the FAFSA and the school considers financial need, available federal allocation, application timing, and institutional policy. Funding is limited, and an award one year does not guarantee another.</p>

<h2>You still need a job</h2>
<p>An award does not guarantee placement. Students usually search, apply, interview, complete employment documents, and meet job qualifications. Start early. Jobs may be on campus or with approved off-campus nonprofit, public, or community-service employers.</p>

<h2>How students are paid</h2>
<p>Students earn wages for hours actually worked and are paid at least the applicable minimum wage. Pay rate, schedule, and payroll frequency depend on the job and institution. Earnings generally go to the student unless the student authorizes another arrangement. You cannot earn beyond the work-study limit without employer approval and another funding source.</p>

<h2>Work-study versus an ordinary job</h2>
<p>Work-study may offer campus convenience, schedules built around classes, and career-relevant roles. A regular job may offer higher pay, more hours, or continued employment after the award is exhausted. Compare net pay, commute, schedule, experience, and whether the job persists during breaks.</p>

<h2>Effect on aid and taxes</h2>
<p>Work-study wages are taxable income when tax rules require, though FAFSA treatment differs from ordinary earnings under applicable formulas. Keep W-2 forms and file required returns. Earnings can change other benefits or budgeting even when treated favorably for federal student aid.</p>

<h2>Manage the award</h2>
<ol>
  <li>Divide the award by the hourly wage to estimate total available hours.</li>
  <li>Divide again across working weeks.</li>
  <li>Track hours and remaining eligibility with the supervisor.</li>
  <li>Plan around exams and academic workload.</li>
  <li>Ask whether employment can continue as regular payroll after FWS ends.</li>
</ol>

<h2>Employment rights and responsibilities</h2>
<p>Work-study students are employees. Complete time records accurately, follow workplace policies, protect confidential information, and report concerns through appropriate channels. Ask human resources about wage, leave, discrimination, harassment, injury, and accommodation procedures.</p>

<h2>Questions before accepting</h2>
<ul>
  <li>Does the offer reserve a job or only eligibility?</li>
  <li>Where are openings posted and when hiring begins?</li>
  <li>What is the pay rate and realistic weekly schedule?</li>
  <li>How are earnings delivered?</li>
  <li>Can the award replace another form of aid if unused?</li>
</ul>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://studentaid.gov/articles/8-things-federal-work-study/">Federal Student Aid: work-study facts</a></li>
  <li><a href="https://studentaid.gov/understand-aid/types/work-study">Federal Student Aid: Federal Work-Study</a></li>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol6">2026–27 FSA Handbook: campus-based programs</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Hiring, pay, and award administration vary by institution and employer.</em></p>
HTML,

        'Tuition, Fees, Room & Board Explained' => <<<'HTML'
<p>College cost is more than tuition. A useful comparison separates <strong>charges billed by the institution</strong> from <strong>other costs of attending</strong>, then subtracts grants and scholarships to estimate net price. “Room and board” is a traditional phrase for housing and food, whether those costs are billed by the school or paid elsewhere.</p>

<h2>Tuition</h2>
<p>Tuition is the price of instruction. It may be charged per credit, term, year, module, or program. Rates can vary by residency, undergraduate or graduate level, major, course, campus, delivery format, and enrollment load. A “flat-rate” tuition band can still have charges above or below the covered credits.</p>

<h2>Fees</h2>
<p>Mandatory fees may support technology, student activities, health services, transit, facilities, labs, clinical placements, online delivery, or specific courses. Some are included in published tuition and others are separate. Ask which fees are mandatory, refundable, recurring, or tied to your exact program.</p>

<h2>Housing and food</h2>
<p>On-campus housing and meal plans are usually direct charges. Off-campus rent, utilities, groceries, deposits, furniture, and commuting are normally paid separately. The cost-of-attendance housing allowance is an estimate and is not a promise that aid will cover your actual lease.</p>

<h2>Direct versus indirect costs</h2>
<ul>
  <li><strong>Direct billed costs:</strong> tuition, required fees, and school-provided housing or food.</li>
  <li><strong>Indirect costs:</strong> books, supplies, equipment, transportation, personal expenses, and off-campus living costs.</li>
</ul>
<p>Both can appear in cost of attendance, but only direct charges normally appear on the student bill. A lower bill does not mean the unbilled costs disappeared.</p>

<h2>Cost of attendance and net price</h2>
<p>Cost of attendance is the school’s aid budget for a defined period and student category. It helps cap aid and calculate need. Net price is generally cost of attendance minus grants and scholarships. Do not subtract loans as though they reduce price, and do not treat work-study as cash available before employment.</p>

<h2>Changes and hidden pressure points</h2>
<p>Budget for annual price increases, course materials, insurance, travel, summer storage, clinical or licensing costs, and years when housing or scholarships change. A delayed course can add an entire term of living costs. Residency reclassification and program changes can alter tuition.</p>

<h2>Refund policies are separate</h2>
<p>Dropping or withdrawing may reduce charges according to an institutional schedule, but the charge adjustment can be smaller than the aid reduction. Learn the add/drop, tuition-refund, housing-contract, meal-plan, and federal aid-return rules before changing enrollment.</p>

<h2>Comparison checklist</h2>
<ol>
  <li>Use the same attendance period and living arrangement for every school.</li>
  <li>Separate tuition, mandatory fees, housing, food, and other estimates.</li>
  <li>Subtract only grants and scholarships for net price.</li>
  <li>Add realistic travel, program, and personal costs.</li>
  <li>Estimate every year through completion.</li>
  <li>Compare likely borrowing and monthly repayment.</li>
</ol>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol3/ch2-cost-attendance-budget">2026–27 FSA Handbook: cost of attendance</a></li>
  <li><a href="https://studentaid.gov/complete-aid-process/how-calculated">Federal Student Aid: how aid is calculated</a></li>
  <li><a href="https://nces.ed.gov/collegenavigator/">College Navigator: institutional cost information</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Use the current tuition schedule, housing contract, student bill, and aid budget for your circumstances.</em></p>
HTML,

        'What Happens to Financial Aid If You Drop a Class?' => <<<'HTML'
<p>Dropping a class can change grants, loans, scholarships, tuition, academic progress, and future eligibility. The result depends on <strong>when you drop, whether you attended, your remaining enrollment, and whether you leave every course</strong>. Ask the registrar, financial aid office, student accounts, and—when relevant—an international, athletics, veterans, or benefits advisor before acting.</p>

<h2>Add/drop versus withdrawal</h2>
<p>An early schedule change may remove a course without a transcript withdrawal, while a later withdrawal may leave a notation and count as attempted credit. Financial-aid census or recalculation dates can differ from the academic add/drop deadline. A course removed from the bill is not necessarily ignored for every aid rule.</p>

<h2>Pell Grants and enrollment intensity</h2>
<p>Pell amounts for term-based programs reflect enrollment intensity. A school may recalculate when enrollment changes under its policy and federal requirements. Never attending a course can require adjustment even after aid disburses. Ask what enrollment the current Pell award assumes and which date controls.</p>

<h2>Federal student loans</h2>
<p>Direct Loans generally require at least half-time enrollment for disbursement. Dropping below half time can cancel a pending disbursement and begin the grace or repayment timeline on applicable loans. Beginning with qualifying loan periods on or after July 1, 2026, annual loan limits may also be prorated for certain less-than-full-time enrollment.</p>

<h2>Scholarships, state aid, and benefits</h2>
<p>Other aid may require full-time status, a minimum number of completed credits, a particular major, continuous enrollment, or a completion date. Veterans education benefits, employer assistance, athletic eligibility, and tuition waivers have separate rules. Obtain an individualized review.</p>

<h2>Satisfactory Academic Progress</h2>
<p>Withdrawn credits may count as attempted but not completed, reducing completion pace. Repeated withdrawals can also push a student toward maximum time frame even when GPA is unchanged. Academic standing and financial-aid satisfactory progress are related but distinct.</p>

<h2>Dropping every class is different</h2>
<p>A complete withdrawal can trigger a Return of Title IV Funds calculation based on the portion of the payment period completed. The school and student may have to return unearned aid, creating a balance even when the institution’s tuition-refund policy produces a different amount. Updated 2026–27 withdrawal rules apply to relevant periods beginning July 1, 2026.</p>

<h2>Before dropping</h2>
<ol>
  <li>Ask the registrar how the course will appear and whether it changes status.</li>
  <li>Ask financial aid for a written before-and-after estimate.</li>
  <li>Ask student accounts how charges change.</li>
  <li>Check scholarship, insurance, housing, athletics, immigration, and benefit rules.</li>
  <li>Consider tutoring, an incomplete, pass/fail, reduced load, or leave only when permitted and appropriate.</li>
  <li>Keep confirmation of the effective date.</li>
</ol>

<h2>If you already dropped</h2>
<p>Review the revised bill and aid offer, return any overpayment as directed, and ask about payment plans or appeals. Do not ignore a new balance; it can block registration or collections even if the course no longer appears in your schedule.</p>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol5">2026–27 FSA Handbook: withdrawals and Return of Title IV Funds</a></li>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch7-initial-calculations-recalculations-and-overawards">2026–27 FSA Handbook: Pell recalculation</a></li>
  <li><a href="https://studentaid.gov/understand-aid/eligibility/staying-eligible">Federal Student Aid: maintaining eligibility</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Obtain an individualized calculation before changing enrollment.</em></p>
HTML,

        'Student Loan Repayment Basics' => <<<'HTML'
<p>Federal student loan repayment usually begins after graduation, leaving school, or dropping below half-time enrollment. Direct Subsidized and Unsubsidized Loans generally have a six-month grace period. Other loan types can follow different rules, and private loans are governed by their contracts.</p>

<h2>Inventory every loan</h2>
<p>Log in to StudentAid.gov to review federal balances, rates, and servicers. Check credit reports and school records for private or institutional loans. Record the borrower, loan type, principal, interest rate, status, servicer, due date, and autopay settings. Parent PLUS belongs to the parent borrower.</p>

<h2>Understand the monthly bill</h2>
<p>Payments usually cover interest and principal according to the plan. A lower monthly payment can improve cash flow but may extend repayment and increase total interest. Compare both the required payment and total projected amount paid.</p>

<h2>Repayment plans changed in 2026</h2>
<p>Plan availability now depends partly on when loans were first disbursed and loan type. New federal options, including the Repayment Assistance Plan and a tiered standard structure, took effect beginning July 1, 2026, while some older plans remain available temporarily or only to eligible earlier borrowers. Use the current Loan Simulator and servicer information rather than an old plan chart.</p>

<h2>Before the first payment</h2>
<ol>
  <li>Complete exit counseling.</li>
  <li>Confirm contact information and servicer.</li>
  <li>Choose a current eligible plan.</li>
  <li>Set a secure payment method and verify the first due date.</li>
  <li>Review autopay terms; current federal incentives can change.</li>
  <li>Build the payment into a realistic monthly budget.</li>
</ol>

<h2>If payment is difficult</h2>
<p>Contact the servicer before missing a payment. Ask about a lower-payment plan, deferment, or forbearance. Temporary pauses can allow interest to accrue and can affect progress toward forgiveness, so compare consequences. Never pay a third party for help your federal servicer provides without charge.</p>

<h2>Forgiveness, cancellation, and discharge</h2>
<p>Programs such as Public Service Loan Forgiveness, teacher forgiveness, disability discharge, borrower defense, and closed-school discharge have specific loan, employment, payment, or event requirements. Verify eligibility through StudentAid.gov, submit required forms, and keep employment and payment records.</p>

<h2>Delinquency and default</h2>
<p>A missed payment creates delinquency. Continued nonpayment can lead to credit reporting, default, collection costs, wage or benefit collection where authorized, and loss of aid eligibility. Open every notice and contact the servicer immediately; waiting reduces options.</p>

<h2>Paying faster</h2>
<p>There is generally no prepayment penalty on federal student loans. Confirm how extra payments are applied and direct them strategically when the servicer permits. Maintain emergency savings and higher-priority obligations rather than using an unsustainable repayment strategy.</p>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://studentaid.gov/articles/prepare-for-payments/">Federal Student Aid: preparing for payments</a></li>
  <li><a href="https://studentaid.gov/loan-simulator/">Federal Student Aid Loan Simulator</a></li>
  <li><a href="https://studentaid.gov/manage-loans/repayment">Federal Student Aid: current repayment information</a></li>
  <li><a href="https://studentaid.gov/articles/avoid-student-loan-forgiveness-scams/">Federal Student Aid: avoiding repayment and forgiveness scams</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Plan availability is borrower- and loan-specific under current rules.</em></p>
HTML,

        'Scholarship Search Resources' => <<<'HTML'
<p>A strong scholarship search combines verified databases with local organizations, employers, institutions, and professional groups. No service can guarantee an award. The most effective strategy is to find opportunities that fit your qualifications, track them carefully, and submit accurate tailored applications before the deadline.</p>

<h2>Start close to home</h2>
<ul>
  <li>the college financial aid office, academic department, honors program, and foundation;</li>
  <li>high school counselors and college-access organizations;</li>
  <li>state higher-education and grant agencies;</li>
  <li>tribal, territorial, municipal, and community foundations;</li>
  <li>employers, unions, professional associations, and community organizations;</li>
  <li>organizations connected to field, service, talent, identity, disability, military affiliation, or location.</li>
</ul>
<p>Local awards may have smaller applicant pools. Ask every year because opportunities and eligibility change.</p>

<h2>Use reputable search tools</h2>
<p>The U.S. Department of Labor sponsors CareerOneStop’s Scholarship Finder. State agencies and institutions maintain their own lists. Large private databases can also be useful, but verify every result on the sponsor’s official site because deadlines and criteria can become stale.</p>

<h2>Build a reusable application kit</h2>
<p>Prepare a résumé or activity list, unofficial transcript, financial information, short biography, service and employment history, and adaptable essays. Ask recommenders early and provide the award purpose, deadline, submission method, and your goals. Never reuse an essay without adjusting it to the actual prompt.</p>

<h2>Track opportunities</h2>
<p>Use a spreadsheet or task system with sponsor, official link, amount, eligibility, deadline and time zone, required materials, recommendation status, submission confirmation, notification date, and renewal rules. Prioritize fit and realistic effort rather than applying blindly to hundreds.</p>

<h2>Verify legitimacy</h2>
<p>Confirm the sponsor’s legal identity and contact information. Read rules and privacy terms. Legitimate scholarships do not guarantee selection, and applicants should be extremely cautious about fees, bank credentials, surprise “finalist” notices, high-pressure deadlines, or requests for a StudentAid.gov password.</p>

<h2>After winning</h2>
<p>Notify the school as required and ask how the award affects the aid package. Confirm whether payment goes to the student or institution, what expenses are allowed, enrollment requirements, tax reporting, renewal conditions, and whether unused funds must be returned.</p>

<h2>Keep searching strategically</h2>
<ol>
  <li>Search at least monthly and before each new academic year.</li>
  <li>Use specific combinations of field, location, employer, service, and student characteristics.</li>
  <li>Submit early enough to resolve technical problems.</li>
  <li>Save confirmation and a complete copy.</li>
  <li>Update successful materials while details are fresh.</li>
</ol>

<hr><h2>Official resources</h2>
<ul>
  <li><a href="https://www.careeronestop.org/toolkit/training/find-scholarships.aspx">U.S. Department of Labor CareerOneStop Scholarship Finder</a></li>
  <li><a href="https://studentaid.gov/articles/financial-aid-not-enough/">Federal Student Aid: scholarship and aid-gap resources</a></li>
  <li><a href="https://www.nasfaa.org/State_Financial_Aid_Programs">NASFAA directory of state financial aid programs</a></li>
  <li><a href="https://consumer.ftc.gov/articles/how-avoid-scholarship-and-financial-aid-scams">FTC: avoid scholarship scams</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Verify every deadline and condition directly with the sponsor.</em></p>
HTML,

        'Common Financial Aid Scams to Avoid' => <<<'HTML'
<p>Financial aid scams exploit urgency, confusion, and the desire to reduce college costs or student debt. They may imitate a government agency, school, scholarship sponsor, servicer, or bank. Slow down and verify through an official website or phone number you locate independently.</p>

<h2>Common warning signs</h2>
<ul>
  <li>a guaranteed scholarship, grant, admission, or loan forgiveness;</li>
  <li>an upfront “processing,” “redemption,” or enrollment fee;</li>
  <li>pressure to act immediately or lose a secret benefit;</li>
  <li>a prize or finalist notice for something you never entered;</li>
  <li>a request for an account password, backup code, or remote device access;</li>
  <li>payment by gift card, cryptocurrency, wire, or unusual transfer;</li>
  <li>a sender address or link that only resembles an official domain.</li>
</ul>

<h2>FAFSA scams</h2>
<p>The FAFSA is free. Be cautious of anyone charging to “unlock” federal aid, altering data to increase eligibility, or asking to control your StudentAid.gov account. Students and contributors must provide accurate information and use their own accounts and signatures.</p>

<h2>Scholarship scams</h2>
<p>Never assume a fee proves legitimacy. Some genuine services sell search assistance, but payment never guarantees an award. Verify the sponsor, rules, prior recipients, selection method, and official contact information before sharing sensitive data.</p>

<h2>Loan-relief scams</h2>
<p>Scammers promise immediate cancellation, special consolidation, or a lower payment for a fee. Federal servicers and official programs do not require a borrower to give a third party the StudentAid.gov password. Current federal repayment and forgiveness applications are available through official channels without a private enrollment fee.</p>

<h2>Refund and billing scams</h2>
<p>Fraudulent messages may claim a refund is waiting, a bill is overdue, or direct-deposit details must be reconfirmed. Open the school portal yourself rather than using the message link. Do not spend an unexpected deposit until student accounts verifies it.</p>

<h2>Protect yourself</h2>
<ol>
  <li>Use unique passwords and multifactor authentication.</li>
  <li>Never share credentials or one-time codes.</li>
  <li>Navigate directly to StudentAid.gov and official school portals.</li>
  <li>Check the exact domain and independently call the organization.</li>
  <li>Read documents before signing and keep copies.</li>
  <li>Monitor bank, credit, school, and StudentAid.gov accounts.</li>
</ol>

<h2>If you responded or paid</h2>
<p>Change affected passwords, revoke unauthorized access, contact the bank or card issuer, notify the school or federal servicer, review account information, preserve messages and receipts, and report the incident. Consider a fraud alert or credit freeze when identity information was exposed.</p>

<h2>Where to report</h2>
<p>Report consumer fraud to the FTC, federal-aid issues through Federal Student Aid, and suspicious school messages to campus security or information technology. Report identity theft through IdentityTheft.gov and follow its recovery plan.</p>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://consumer.ftc.gov/articles/how-avoid-scholarship-and-financial-aid-scams">FTC: scholarship and financial aid scams</a></li>
  <li><a href="https://studentaid.gov/articles/avoid-student-loan-forgiveness-scams/">Federal Student Aid: loan-forgiveness scams</a></li>
  <li><a href="https://reportfraud.ftc.gov/">FTC ReportFraud</a></li>
  <li><a href="https://www.identitytheft.gov/">IdentityTheft.gov recovery guidance</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Verify messages through independently located official channels.</em></p>
HTML,

        'Financial Aid Questions Megathread' => <<<'HTML'
<p>Use this megathread for general financial aid questions and shared experience. Community members can help explain terminology, suggest questions for an aid office, and compare processes. They cannot view your official record, guarantee eligibility, replace professional financial or legal advice, or override an institution or aid provider.</p>

<h2>Before posting</h2>
<p>Review your FAFSA Submission Summary, aid offer, student-account ledger, and the relevant school page. Note the award year, student level, general enrollment status, and the type of aid involved. Contact the financial aid office for a deadline, missing document, account-specific calculation, or appeal.</p>

<h2>Never post sensitive information</h2>
<ul>
  <li>Social Security, taxpayer, alien-registration, passport, or driver-license numbers;</li>
  <li>StudentAid.gov or school usernames, passwords, backup codes, or security answers;</li>
  <li>full birth dates, addresses, bank details, tax returns, or account screenshots;</li>
  <li>unredacted award letters, verification documents, immigration records, or signatures;</li>
  <li>private information about parents, spouses, children, or other students.</li>
</ul>

<h2>How to ask a useful question</h2>
<p>State the country and award year because rules change. Describe the institution type and program without naming yourself. Identify whether you are undergraduate, graduate, professional, dependent, or independent if relevant. Quote only the generic label or message, not personal identifiers. Explain what the office told you and the deadline you face.</p>

<h2>Good question format</h2>
<ol>
  <li><strong>Goal:</strong> what decision or term are you trying to understand?</li>
  <li><strong>Context:</strong> award year, level, enrollment, and aid type.</li>
  <li><strong>Documents checked:</strong> FAFSA summary, offer, bill, or policy.</li>
  <li><strong>Exact issue:</strong> the general error or mismatch.</li>
  <li><strong>Deadline:</strong> when an official response is needed.</li>
</ol>

<h2>Topics suited to the community</h2>
<p>Examples include interpreting common offer labels, preparing questions for an appeal, comparing grants and loans, organizing scholarship searches, understanding general disbursement steps, or sharing work-study job-search experience.</p>

<h2>Questions requiring the school or agency</h2>
<p>Only the responsible office can resolve verification, professional judgment, satisfactory-progress appeals, residency, Return of Title IV Funds, disbursement holds, account balances, scholarship adjustments, or aid cancellation. Legal-status questions may also require an accredited immigration attorney or qualified nonprofit representative.</p>

<h2>Urgent situations</h2>
<p>For imminent housing loss, food insecurity, medical need, transportation failure, or inability to attend, contact student emergency aid, basic-needs services, advising, and financial aid immediately. For fraud, lock affected accounts and contact the bank, school, servicer, and appropriate reporting agency.</p>

<h2>Evaluate replies carefully</h2>
<p>Look for current official sources and distinguish personal experience from policy. Rules vary by award year and institution. Do not follow instructions to misreport information, pay an unknown intermediary, or move the conversation to a channel requesting personal data.</p>

<hr><h2>Official starting points</h2>
<ul>
  <li><a href="https://studentaid.gov/help-center/contact">Federal Student Aid Help Center</a></li>
  <li><a href="https://studentaid.gov/feedback-center/">Federal Student Aid Feedback Center</a></li>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027">2026–27 Federal Student Aid Handbook</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Protect personal information and confirm decisions with the office that controls the aid.</em></p>
HTML,

        'How Legal Status Impacts Financial Aid for Students and Parents' => <<<'HTML'
<p>Legal status affects financial aid differently for the <strong>student</strong> and the student’s <strong>parents or other FAFSA contributors</strong>. For federal student aid, the student must satisfy citizenship or eligible-noncitizen requirements. A parent’s citizenship or immigration status does not by itself determine an otherwise eligible student’s federal-aid eligibility.</p>

<blockquote><strong>This is general educational information, not legal advice.</strong> Immigration categories and documentation are technical. Use current Federal Student Aid instructions and obtain advice from a qualified immigration professional when status is uncertain.</blockquote>

<h2>Student eligibility</h2>
<p>Federal Title IV aid generally requires the student to be a U.S. citizen or national, a citizen of certain Freely Associated States for specified aid, a lawful permanent resident, or another eligible noncitizen category recognized by federal law. The school may need federal database confirmation or documentation.</p>
<p>Not every lawful presence, visa, employment authorization, pending application, parole category, or humanitarian status qualifies. DACA by itself does not make a student eligible for federal student aid. Never select a status that is inaccurate simply to submit the form.</p>

<h2>Students who are not federally eligible</h2>
<p>Students who are undocumented, have DACA, hold many nonimmigrant visas, or otherwise do not meet federal categories may still qualify for state, tribal, territorial, institutional, private, employer, or community assistance. Eligibility and application forms vary. Some states use an alternative aid application.</p>
<p>Ask the institution what application is accepted and how information is protected. International students should contact the international office and search institution-specific funding; federal aid is generally limited.</p>

<h2>Parents and contributors</h2>
<p>A dependent student may need parent information even when the parent is not a citizen, does not have an SSN, does not live in the United States, or does not file a U.S. tax return. Under the current online process, a required contributor without an SSN can create a StudentAid.gov account, complete the assigned section, provide required consent and approval, and sign.</p>
<p>Being a contributor does not make the parent liable for the student’s federal student loans. A parent becomes a borrower only by separately obtaining a Parent PLUS or other loan.</p>

<h2>Tax and identity information</h2>
<p>Follow the FAFSA instructions for contributors who have an Individual Taxpayer Identification Number, foreign income, foreign tax filing, or no filing requirement. Do not enter a fabricated SSN. Names and dates should match account and identity records. Each contributor must use a separate account.</p>

<h2>Dependency is a separate question</h2>
<p>A student is not independent merely because parents are undocumented, live abroad, refuse to contribute, or cannot afford college. Federal dependency status is defined by law. Students facing unusual circumstances that prevent parent contact or create risk should contact the financial aid office about provisional independence or a dependency override. Documentation is normally required.</p>

<h2>Mixed-status family safety</h2>
<p>Use StudentAid.gov directly and avoid anyone promising to manipulate status or “guarantee” aid. Do not share passwords. Before sending sensitive records, confirm the request through the school’s official portal or published phone number. Ask which documents are actually required and how they will be transmitted and retained.</p>

<h2>When status is not verified</h2>
<ol>
  <li>Read the FAFSA Submission Summary comment and school request.</li>
  <li>Confirm that name, birth date, SSN, A-Number, and selected category are accurate.</li>
  <li>Do not upload immigration documents to an unverified link.</li>
  <li>Work with the financial aid office on the federal confirmation process.</li>
  <li>Seek qualified legal help before changing an immigration representation.</li>
  <li>Continue applying for nonfederal aid for which you qualify.</li>
</ol>

<h2>Where to get trustworthy help</h2>
<p>Use Federal Student Aid for FAFSA processing, the school for aid packaging, the state agency for state programs, and an attorney or Department of Justice–recognized organization for immigration legal advice. Community discussion can suggest questions but cannot determine status.</p>

<hr><h2>Official sources</h2>
<ul>
  <li><a href="https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol1/ch2-us-citizenship-eligible-noncitizens">2026–27 FSA Handbook: citizenship and eligible noncitizens</a></li>
  <li><a href="https://studentaid.gov/articles/key-facts-accounts/">Federal Student Aid: accounts for contributors without an SSN</a></li>
  <li><a href="https://studentaid.gov/articles/fafsa-for-parents/">Federal Student Aid: 2026–27 FAFSA steps for parents</a></li>
  <li><a href="https://www.justice.gov/eoir/recognition-accreditation-roster-reports">U.S. Department of Justice: recognized organizations and accredited representatives</a></li>
</ul>
<p><em>Last reviewed: August 16, 2026. Federal, state, institutional, and immigration rules can change; obtain case-specific guidance.</em></p>
HTML,
    ];
}
