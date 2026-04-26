/**
 * Schedule A — Beauty Pay: Merchant Agreement section. JSX-only, no
 * client logic. Content from terms_final.html mockup §A (locked 7A Q7).
 */

export default function ScheduleASection() {
  return (
    <>
      <div className="tp-sched-head">
        <div className="tp-sched-badge">Schedule A</div>
        <div className="tp-sched-title">Beauty Pay — Merchant Agreement</div>
        <div className="tp-sched-sub">For Beauty Businesses using the DECODE Beauty Pay payment link service. Forms part of the DECODE Terms of Service and is read together with the General Terms.</div>
      </div>

      <p>By creating an account and selecting &quot;I agree&quot;, you confirm you are authorised to represent your Beauty Business and accept this Schedule.</p>

      <h2>1. Platform role &amp; services</h2>
      <p>DECODE provides Beauty Businesses with the ability to generate and share payment links for their services through the Platform. Clients pay through those links; DECODE collects and remits the funds to the Beauty Business.</p>
      <p>For the purposes of Beauty Pay:</p>
      <ul>
        <li>DECODE acts as the merchant of record and processes all payments through licensed, PCI DSS Level 1 compliant payment service providers regulated in the UAE</li>
        <li>DECODE is solely a payment technology intermediary and does not enter into any contract with your clients for the provision of beauty services</li>
        <li>All contracts for services are exclusively between you, the Beauty Business, and your clients</li>
        <li>DECODE has no involvement in and assumes no liability for the nature, quality, safety, legality, or delivery of any services you provide</li>
      </ul>

      <h2>2. Account registration &amp; verification</h2>
      <p>In addition to the eligibility requirements in the General Terms, Beauty Businesses using Beauty Pay must:</p>
      <ul>
        <li>Provide Emirates ID of the authorised signatory</li>
        <li>Provide beneficial ownership information</li>
        <li>Submit bank account verification documents confirming account ownership</li>
        <li>Maintain a valid and operational UAE bank account or PayPal account for payout purposes</li>
      </ul>
      <p>DECODE and its payment service providers are authorised to collect, hold, and disburse payments on your behalf in accordance with this Schedule.</p>

      <h2>3. Payments &amp; fee structure</h2>
      <h3>3.1 How it works</h3>
      <p>When you create a payment link, you specify your desired service amount. DECODE automatically adds the applicable transaction fee on top of that amount. The fee is charged to your client. You receive 100% of your specified service amount in your payout. DECODE retains only the transaction fee. There are no subscription fees, monthly fees, setup fees, or any other fixed charges.</p>

      <h3>3.2 Fee table</h3>
      <div className="tp-table-wrap">
        <table className="tp-table">
          <thead><tr><th>Service amount (AED)</th><th>Fee</th></tr></thead>
          <tbody>
            <tr><td>5 – 999</td><td>7%</td></tr>
            <tr><td>1,000 – 2,499</td><td>6%</td></tr>
            <tr><td>2,500 – 4,999</td><td>5%</td></tr>
            <tr><td>5,000 – 9,999</td><td>4%</td></tr>
            <tr><td>10,000 – 24,999</td><td>3.5%</td></tr>
            <tr><td>25,000 – 49,999</td><td>3.4%</td></tr>
            <tr><td>50,000 – 74,999</td><td>3.3%</td></tr>
            <tr><td>75,000 – 100,000</td><td>3.2%</td></tr>
          </tbody>
        </table>
      </div>
      <p>All payments are processed in AED within the UAE.</p>

      <h3>3.3 Client transparency</h3>
      <p>You must inform your clients that payment processing is provided by DECODE and that the total amount shown in the payment link includes both your service price and DECODE&apos;s transaction fee.</p>

      <h2>4. Payout schedule</h2>
      <p>Payouts are typically processed within 1–2 business days of transaction completion, subject to:</p>
      <ul>
        <li>No pending disputes, chargebacks, or fraud investigations</li>
        <li>A valid and operational payout account being on file</li>
      </ul>
      <p>In the event of a payout delay exceeding 5 business days, DECODE will provide regular status updates to your registered email address.</p>
      <p>You may access detailed transaction reports through your DECODE dashboard at any time.</p>

      <h2>5. Refunds &amp; chargebacks</h2>
      <h3>5.1 Refunds</h3>
      <p>Refund requests may be submitted by you through the Platform. All payment processing and refund fees are borne by the Beauty Business. Approved refunds will be processed to the original payment method within 3–10 business days.</p>
      <h3>5.2 Chargebacks</h3>
      <p>Chargebacks will be deducted from future payouts. You will be notified within 24 hours of any chargeback being raised and will have 7 days to provide supporting documentation to contest it.</p>
      <h3>5.3 Suspicious activity</h3>
      <p>DECODE may delay or suspend payouts if suspected fraud, excessive chargebacks, or other suspicious activity is detected. In such cases DECODE will notify you within 24 hours and provide:</p>
      <ul>
        <li>The specific reason for the delay or suspension</li>
        <li>The actions required to resolve the matter</li>
        <li>An expected review timeline, not to exceed 30 days</li>
      </ul>
      <p>You may appeal any suspension by submitting supporting documentation to <a href="mailto:support@welovedecode.com">support@welovedecode.com</a> within 7 days of notification.</p>

      <h2>6. Taxes &amp; VAT</h2>
      <p>Each Beauty Business is solely responsible for determining, collecting, and remitting VAT and any other applicable taxes on its sales. DECODE does not calculate, collect, or remit taxes on behalf of Beauty Businesses.</p>
      <p>You agree to provide DECODE with any required tax documentation upon request and to maintain accurate tax records for all transactions processed through the Platform.</p>

      <h2>7. Beauty Business obligations</h2>
      <p>You are solely responsible for:</p>
      <ul>
        <li>All client service inquiries, complaints, and dispute resolution</li>
        <li>The delivery, quality, and safety of all services</li>
        <li>Handling all refund and cancellation requests from clients</li>
        <li>Providing clear terms of sale and accurate service descriptions in your payment links</li>
        <li>Maintaining all valid UAE licences required to operate your business and deliver your services</li>
        <li>Directing clients to contact you directly for any post-payment queries</li>
      </ul>

      <h2>8. Account security</h2>
      <p>You are responsible for all activity that occurs under your account. You must:</p>
      <ul>
        <li>Keep your login credentials secure and confidential</li>
        <li>Not share account access with unauthorised persons</li>
        <li>Report any suspected misuse or unauthorised access to DECODE within 48 hours of discovery</li>
      </ul>
      <p>DECODE is not liable for losses caused by unauthorised access to your account except where such access results directly from DECODE&apos;s gross negligence or wilful misconduct.</p>

      <h2>9. Suspension &amp; termination</h2>
      <h3>9.1 DECODE&apos;s right to suspend or terminate</h3>
      <p>DECODE may suspend or terminate your Beauty Pay account if:</p>
      <ul>
        <li>Fraud, excessive chargebacks, or suspicious activity is detected</li>
        <li>Required by payment service provider regulations or UAE law</li>
        <li>You breach these Terms or engage in any prohibited activity</li>
        <li>Your business licence expires, lapses, or is revoked</li>
        <li>You fail to respond to verification or documentation requests within 14 business days</li>
      </ul>
      <p>DECODE will provide written notice by email at least 24 hours before suspension or termination, except where immediate action is required to prevent fraud, comply with law, or protect the Platform or other users.</p>
      <h3>9.2 Your right to terminate</h3>
      <p>You may terminate this Schedule at any time by providing 30 days&apos; written notice to <a href="mailto:support@welovedecode.com">support@welovedecode.com</a>.</p>
      <p>Upon termination:</p>
      <ul>
        <li>You must immediately cease using the Platform and all active payment links</li>
        <li>Pending transactions will be processed and paid out according to the normal schedule</li>
        <li>Any outstanding fees, chargebacks, or liabilities remain your responsibility</li>
        <li>DECODE will retain transaction records for 7 years as required by UAE law</li>
      </ul>

      <h2>10. Limitation of liability</h2>
      <p>DECODE&apos;s total aggregate liability to you for any claim arising from or related to Beauty Pay shall not exceed the total fees collected by DECODE on your transactions during the three months immediately preceding the claim.</p>
      <p>DECODE is not liable for any indirect, incidental, special, consequential, or punitive damages including loss of profit, revenue, data, goodwill, or business opportunity, even if advised of the possibility of such damages.</p>
      <p>This limitation does not apply to fraud or fraudulent misrepresentation by DECODE, or to any liability that cannot be excluded under UAE law.</p>
      <p>You agree to indemnify and hold harmless DECODE LLC, its affiliates, officers, and employees from any losses, claims, damages, or expenses arising from your use of the Platform, your services, chargebacks or disputes raised by your clients, or your breach of any applicable UAE law or these Terms.</p>
    </>
  )
}
