/**
 * Schedule C — Beauty Deals: Client Purchase Terms section. JSX-only.
 * Content from terms_final.html mockup §C (locked 7A Q7).
 */

export default function ScheduleCSection() {
  return (
    <>
      <div className="tp-sched-head">
        <div className="tp-sched-badge">Schedule C</div>
        <div className="tp-sched-title">Beauty Deals — Client Purchase Terms</div>
        <div className="tp-sched-sub">For clients purchasing vouchers through the DECODE Beauty Deals marketplace. Forms part of the DECODE Terms of Service and is read together with the General Terms.</div>
      </div>

      <p>By completing a purchase on Beauty Deals, you confirm you have read and accept these terms.</p>

      <h2>1. What the Platform is</h2>
      <p>DECODE operates Beauty Deals as a marketplace that connects clients with discounted beauty service offers from independent beauty businesses. When you purchase a voucher through Beauty Deals:</p>
      <ul>
        <li>Your contract for the service is exclusively between you and the Beauty Business</li>
        <li>DECODE is not the service provider and is not a party to that contract</li>
        <li>DECODE acts solely as a disclosed commercial agent facilitating the transaction</li>
        <li>DECODE is not responsible for the quality, safety, delivery, or outcome of any service you receive</li>
        <li>All professional liability for services rests solely with the Beauty Business delivering them</li>
      </ul>

      <h2>2. How purchases &amp; vouchers work</h2>
      <h3>2.1 Purchasing</h3>
      <p>All purchases are made in AED through the Platform. Upon successful payment you will receive a unique QR code voucher. This voucher is your proof of purchase and your entitlement to redeem the service with the relevant Beauty Business.</p>
      <h3>2.2 Booking your appointment</h3>
      <p>After purchase you will be directed to the Beauty Business&apos;s WhatsApp to coordinate your appointment. You may also contact the Beauty Business through any other channel you prefer. DECODE does not operate a booking system and is not responsible for appointment scheduling.</p>
      <h3>2.3 Redeeming your voucher</h3>
      <p>Present your QR code to the Beauty Business at the time of your visit. The Beauty Business will scan your QR code in the Platform app after your service is completed. This scan officially confirms redemption and starts the 24-hour complaint window.</p>
      <h3>2.4 Voucher validity</h3>
      <p>All vouchers are valid for 3 months from the date of purchase, in compliance with applicable UAE consumer protection regulations. After 3 months the voucher expires automatically and no refund or complaint is possible.</p>

      <h2>3. Refund policy</h2>
      <div className="tp-table-wrap">
        <table className="tp-table">
          <thead><tr><th>Situation</th><th>Window</th><th>Resolution</th></tr></thead>
          <tbody>
            <tr><td>Change of mind — voucher not used</td><td>Within 3 days of purchase</td><td>Full refund to original payment method</td></tr>
            <tr><td>Bad service — after visiting the Beauty Business</td><td>Within 24 hours of QR redemption</td><td>Written complaint submitted via the app. DECODE reviews case by case and decides resolution at its sole discretion.</td></tr>
            <tr><td>Voucher expired unused</td><td>After 3 months</td><td>No refund or complaint possible</td></tr>
          </tbody>
        </table>
      </div>
      <p><strong>Refund limit.</strong> No refund shall exceed the total amount paid by you for the relevant transaction.</p>

      <h2>4. Complaints process</h2>
      <p>If you are dissatisfied with a service you received, you must:</p>
      <ul>
        <li>Submit a written complaint through the Platform app within 24 hours of QR redemption</li>
        <li>Include a clear description of the issue and any supporting evidence such as photographs</li>
        <li>DECODE will review your complaint on a case-by-case basis and contact you with its decision</li>
      </ul>
      <p>DECODE reserves sole discretion to determine the outcome of all complaints based on available evidence. Possible outcomes include a full refund, partial refund, or no refund. DECODE&apos;s decision is final.</p>
      <p>Please note that DECODE is not the service provider. Where a complaint relates to professional conduct, injury, or harm caused by a Beauty Business, you may also have the right to seek recourse directly through UAE consumer protection authorities.</p>

      <h2>5. Limitation of liability</h2>
      <p>DECODE&apos;s total liability to you in respect of any transaction shall not exceed the total amount you paid for that transaction.</p>
      <p>DECODE is not liable for any indirect, consequential, or incidental loss arising from your use of the Platform or from services provided by a Beauty Business, including but not limited to physical injury, dissatisfaction, loss of time, or loss of opportunity.</p>
      <p>DECODE is not liable for any failure or delay caused by third-party services including payment processors, WhatsApp, or mobile network providers.</p>
    </>
  )
}
