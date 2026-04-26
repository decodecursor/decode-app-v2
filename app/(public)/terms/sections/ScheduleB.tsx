/**
 * Schedule B — Beauty Deals: Business Partner Agreement section.
 * JSX-only. Content from terms_final.html mockup §B (locked 7A Q7).
 */

export default function ScheduleBSection() {
  return (
    <>
      <div className="tp-sched-head">
        <div className="tp-sched-badge">Schedule B</div>
        <div className="tp-sched-title">Beauty Deals — Business Partner Agreement</div>
        <div className="tp-sched-sub">For Beauty Businesses listing discounted offers on the DECODE Beauty Deals marketplace. Forms part of the DECODE Terms of Service and is read together with the General Terms.</div>
      </div>

      <p>By registering as a Beauty Deals partner, you confirm you are authorised to represent your Beauty Business and accept this Schedule.</p>

      <h2>1. Platform role &amp; legal relationship</h2>
      <p>DECODE is not a party to the contract between the Beauty Business and the client. The Beauty Business is solely responsible for the service. DECODE&apos;s role is limited to operating the marketplace platform and facilitating the transaction.</p>
      <p>This means:</p>
      <ul>
        <li>The Beauty Business remains the legal supplier of services to the client in all circumstances</li>
        <li>DECODE is not the service provider, merchant of record, or contracting party for any beauty service listed on the Platform</li>
        <li>DECODE is not responsible for the quality, safety, delivery, or outcome of any service</li>
        <li>By listing on the Platform, the Beauty Business expressly accepts full professional and legal responsibility for all services delivered to clients</li>
      </ul>

      <h2>2. Listing eligibility</h2>
      <p>To list offers on Beauty Deals, the Beauty Business must:</p>
      <ul>
        <li>Hold a valid UAE commercial trade licence covering the services being offered</li>
        <li>Ensure all practitioners delivering listed services hold any required professional qualifications or licences under UAE law (if required)</li>
        <li>Maintain an active WhatsApp number for client appointment coordination</li>
        <li>Keep all listing information accurate, current, and not misleading</li>
      </ul>
      <p>DECODE reserves the right to reject, remove, or suspend any listing at its sole discretion, including where a listing is found to be inaccurate, unlicensed, or in breach of these Terms.</p>

      <h2>3. Commission &amp; pricing</h2>
      <h3>3.1 Commission rate</h3>
      <p>DECODE charges a fixed commission of <strong>9% on every transaction</strong>. This is automatically deducted at the point of purchase and covers the platform fee and all credit card processing costs. No subscription fees, listing fees, or any other charges apply.</p>

      <h3>3.2 Calculation basis</h3>
      <p>The 9% commission is calculated on the VAT-exclusive price of the offer only. It is not calculated on the VAT component of the transaction.</p>

      <h3>3.3 Example</h3>
      <div className="tp-table-wrap">
        <table className="tp-table">
          <thead><tr><th>Item</th><th>Amount (AED)</th></tr></thead>
          <tbody>
            <tr><td>Offer price (VAT-exclusive)</td><td>500.00</td></tr>
            <tr><td>VAT at 5% — collected &amp; remitted by Beauty Business to FTA</td><td>25.00</td></tr>
            <tr className="tot"><td>Total client pays</td><td>525.00</td></tr>
            <tr><td>Platform commission 9% (on AED 500 ex-VAT)</td><td>45.00</td></tr>
            <tr className="tot"><td>Amount due to Beauty Business</td><td>455.00</td></tr>
          </tbody>
        </table>
      </div>

      <h2>4. VAT &amp; invoicing obligations</h2>
      <p>VAT compliance is the sole responsibility of the Beauty Business. Specifically:</p>
      <ul>
        <li>The Beauty Business must issue a valid UAE Tax Invoice to the client at the time of service for the full VAT-inclusive amount</li>
        <li>The Beauty Business is solely responsible for remitting VAT to the UAE Federal Tax Authority (FTA)</li>
        <li>DECODE does not collect or remit VAT on behalf of Beauty Businesses</li>
        <li>DECODE will issue a separate Tax Invoice to the Beauty Business for the 9% commission charge only</li>
        <li>The DECODE Tax Invoice to the Beauty Business is the only invoicing obligation of the Platform — DECODE does not issue invoices to clients on behalf of Beauty Businesses</li>
      </ul>
      <p>Failure to comply with UAE VAT invoicing obligations is a material breach of this Schedule and may result in immediate suspension of the Beauty Business&apos;s account.</p>

      <h2>5. Payout system</h2>
      <h3>5.1 Payout schedule</h3>
      <p>Payouts are made every Wednesday. The weekly cycle runs Monday to Sunday. The full amount due to the Beauty Business is released on the Wednesday following the week in which QR redemption occurred and the 48-hour complaint window has elapsed with no upheld complaint.</p>
      <p>If a voucher is not redeemed within the 3-month validity period, the full amount due is released on the Wednesday following the voucher expiry date.</p>

      <h2>6. Voucher &amp; QR redemption</h2>
      <h3>6.1 Voucher validity</h3>
      <p>All vouchers are valid for 3 months from the purchase date, in compliance with applicable UAE consumer protection regulations. After 3 months the voucher expires and all financial obligations close automatically.</p>
      <h3>6.2 QR redemption</h3>
      <p>Every purchase generates a unique QR code issued to the client. Redemption is officially confirmed when the Beauty Business scans the client&apos;s QR code in the Platform app. This scan is the sole trigger for:</p>
      <ul>
        <li>Confirming that the service was delivered</li>
        <li>Starting the 48-hour client complaint window</li>
        <li>Triggering the payout release subject to no upheld complaint</li>
      </ul>
      <h3>6.3 Unredeemed vouchers</h3>
      <p>If a voucher is not redeemed within the 3-month validity period, the full amount due to the Beauty Business is automatically released the following Wednesday after expiry. No refund or complaint is possible after expiry.</p>
      <h3>6.4 Technical failure</h3>
      <p>If a QR scan fails due to a verified technical issue, the Beauty Business must contact Platform support within 48 hours with proof of service delivery. DECODE will review and, if satisfied, manually trigger the redemption.</p>

      <h2>7. Complaints, clawback &amp; offset rights</h2>
      <h3>7.1 Client complaint window</h3>
      <p>Clients have 48 hours from the moment of QR scan to submit a written complaint. DECODE reviews all complaints on a case-by-case basis and determines the outcome at its sole discretion.</p>
      <h3>7.2 Platform authority</h3>
      <p>DECODE reserves the right to:</p>
      <ul>
        <li>Determine refund eligibility based on available evidence</li>
        <li>Claw back or offset any refunded or disputed amount against the Beauty Business&apos;s pending or future payouts, with no time limit and no minimum balance required, until the full amount is recovered</li>
        <li>Withhold or recover any disputed amount from pending or future payouts in the event of a client payment dispute or chargeback</li>
        <li>Withhold any scheduled payout pending resolution of any open dispute or complaint</li>
        <li>Act on legal basis to recover the pending amounts</li>
      </ul>
      <h3>7.3 No refund limit exceeded</h3>
      <p>No refund issued to a client shall exceed the total amount paid by that client for the relevant transaction.</p>

      <h2>8. Beauty Business obligations</h2>
      <p>The Beauty Business agrees at all times to:</p>
      <ul>
        <li>Deliver services to the standard reasonably expected by a client purchasing a discounted offer</li>
        <li>Respond to Platform support requests within 48 hours</li>
        <li>Maintain an active and monitored WhatsApp number for client appointment coordination</li>
        <li>Not engage in any conduct designed to manipulate the Platform, including artificially inflating transaction counts</li>
        <li>Not instruct or encourage clients to redeem vouchers for services not yet delivered</li>
        <li>Honour all vouchers sold through the Platform and deliver the relevant service to the client within the validity period. Failure or refusal to honour a valid voucher without reasonable justification is a material breach of this Schedule and may result in immediate account suspension and a full refund being issued to the client, recovered from the Beauty Business</li>
      </ul>

      <h2>9. Suspension &amp; termination</h2>
      <h3>9.1 DECODE&apos;s right to suspend or terminate</h3>
      <p>DECODE may suspend or terminate a Beauty Business&apos;s account on Beauty Deals if:</p>
      <ul>
        <li>Fraudulent activity or manipulation of the Platform is detected</li>
        <li>An excessive number of complaints are upheld against the Beauty Business</li>
        <li>The Beauty Business&apos;s trade licence expires, lapses, or is revoked</li>
        <li>The Beauty Business breaches any provision of this Schedule or the General Terms</li>
        <li>Required by UAE law or payment service provider regulations</li>
      </ul>
      <p>DECODE will provide written notice by email before suspension or termination, except where immediate action is required to prevent fraud, protect clients, or comply with law.</p>
      <h3>9.2 In-flight funds on suspension or termination</h3>
      <p>In the event of account suspension or termination, all funds not yet released will be held by DECODE until the investigation is resolved. Upon resolution:</p>
      <ul>
        <li>If no wrongdoing is found, held funds will be released to the Beauty Business on the next available Wednesday payout cycle</li>
        <li>If wrongdoing is found, DECODE reserves the right to apply held funds against any amounts owed by the Beauty Business to DECODE or to clients</li>
      </ul>
      <h3>9.3 Your right to terminate</h3>
      <p>You may terminate this Schedule at any time by providing 30 days&apos; written notice. Pending transactions and payouts will be processed according to the normal schedule. Any outstanding liabilities, clawback obligations, or upheld complaints remain your responsibility after termination.</p>

      <h2>10. Limitation of liability</h2>
      <p>The Platform&apos;s total liability to any party shall not exceed the commission amount received by DECODE in respect of the specific transaction in dispute.</p>
      <p>DECODE is not liable for any indirect, consequential, special, or incidental damages of any kind, including loss of revenue, loss of profit, or loss of business opportunity arising from the Beauty Business&apos;s use of Beauty Deals.</p>
      <p>DECODE is not liable for any failure or delay caused by third-party services including payment processors, WhatsApp, or mobile network providers.</p>
      <p>You agree to indemnify and hold harmless DECODE LLC, its affiliates, officers, and employees from any losses, claims, damages, or expenses arising from your use of the Platform, services delivered to clients, complaints or chargebacks raised by clients, or your breach of any applicable UAE law or these Terms.</p>
    </>
  )
}
