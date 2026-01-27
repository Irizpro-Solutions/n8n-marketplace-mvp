import Link from 'next/link';

export const metadata = {
  title: 'Refund & Cancellation Policy - AI Agent Marketplace',
  description: 'Refund and cancellation policy for AI Agent Marketplace powered by Irizpro',
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Back to Marketplace
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Refund & Cancellation Policy</h1>
          <p className="text-gray-600">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              This Refund and Cancellation Policy outlines the terms for refunds and cancellations on the AI Agent
              Marketplace operated by Irizpro. We strive to provide fair and transparent policies for our digital
              services while maintaining the integrity of our credit-based system.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Credit Purchases</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>1.1 Refund Window:</strong> Credits purchased through our marketplace are eligible for a full
                refund within <strong>7 days of purchase</strong>, subject to the conditions below.
              </p>
              <p>
                <strong>1.2 Conditions for Refund:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Credits must be unused (no workflow executions performed)</li>
                <li>Request must be submitted within 7 days of purchase</li>
                <li>Valid reason must be provided for the refund request</li>
                <li>Account must not have violated our Terms and Conditions</li>
              </ul>
              <p>
                <strong>1.3 Processing Fee:</strong> A processing fee of ₹50 (or 2% of transaction amount, whichever
                is higher) will be deducted from the refund amount to cover payment gateway charges.
              </p>
              <p>
                <strong>1.4 Refund Timeline:</strong> Approved refunds will be processed within 5-7 business days. The
                amount will be credited to the original payment method used for the purchase.
              </p>
              <p>
                <strong>1.5 Partial Credit Usage:</strong> If you have used some credits from your purchase, only the
                unused portion (if any) may be eligible for refund, minus the processing fee.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Agent Access Purchases</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>2.1 No Refund After Access:</strong> Once you purchase access to an AI agent, that purchase is
                <strong> non-refundable</strong>. Agent access grants you the ability to execute workflows indefinitely
                (subject to credit availability).
              </p>
              <p>
                <strong>2.2 Pre-Purchase Information:</strong> We provide detailed information about each agent,
                including descriptions, features, and credit costs. Please review this information carefully before
                purchasing.
              </p>
              <p>
                <strong>2.3 Technical Issues:</strong> If you encounter technical issues preventing you from using an
                agent you purchased, contact our support team. We will investigate and may provide:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Technical assistance to resolve the issue</li>
                <li>Bonus credits as compensation</li>
                <li>Refund in exceptional cases at our discretion</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Workflow Execution Refunds</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>3.1 Failed Executions:</strong> If a workflow execution fails due to technical issues on our
                platform or the n8n service, we will refund the credits consumed for that execution.
              </p>
              <p>
                <strong>3.2 User Error:</strong> Credits will <strong>not be refunded</strong> for executions that fail
                due to:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Invalid or incorrect input data provided by the user</li>
                <li>External API failures beyond our control</li>
                <li>Third-party service limitations or restrictions</li>
                <li>User violation of service terms</li>
              </ul>
              <p>
                <strong>3.3 Incomplete Results:</strong> If a workflow execution completes but produces incomplete or
                unexpected results, contact support with execution details. We will review and may provide credit
                refunds on a case-by-case basis.
              </p>
              <p>
                <strong>3.4 Automatic Refunds:</strong> In cases of system-detected failures, credits may be
                automatically refunded to your account within 24-48 hours.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Cancellation Policy</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>4.1 Pending Transactions:</strong> You can cancel a credit purchase transaction before payment
                completion. Once payment is confirmed by Razorpay, the transaction cannot be cancelled (refund policy
                applies instead).
              </p>
              <p>
                <strong>4.2 Workflow Execution:</strong> Workflow executions cannot be cancelled once initiated. Credits
                are deducted immediately upon execution start.
              </p>
              <p>
                <strong>4.3 Account Cancellation:</strong> You may request account deletion at any time. Upon account
                deletion:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Unused credits in your account will be forfeited (no refund)</li>
                <li>All execution history and data will be permanently deleted</li>
                <li>Access to all purchased agents will be revoked</li>
                <li>This action is irreversible</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Exceptions and Special Circumstances</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>5.1 Fraudulent Transactions:</strong> If we detect fraudulent activity or unauthorized
                transactions on your account, we will investigate and may issue full refunds.
              </p>
              <p>
                <strong>5.2 Service Discontinuation:</strong> If we discontinue a specific agent or service, users who
                purchased access will be notified in advance. Options may include:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Migration to an alternative agent</li>
                <li>Bonus credits as compensation</li>
                <li>Partial refund for recently purchased access</li>
              </ul>
              <p>
                <strong>5.3 Platform Shutdown:</strong> In the unlikely event of platform shutdown, we will provide at
                least 30 days notice and refund unused credits (minus processing fees).
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. How to Request a Refund</h2>
            <div className="space-y-4 text-gray-700">
              <p>To request a refund, please follow these steps:</p>
              <ol className="list-decimal pl-6 space-y-2 mt-2">
                <li>
                  <strong>Contact Support:</strong> Email us at <a href="mailto:nidhi@irizpro.in" className="text-blue-600 hover:underline">nidhi@irizpro.in</a> with
                  the subject line "Refund Request - [Your Account Email]"
                </li>
                <li>
                  <strong>Provide Details:</strong> Include your transaction ID, order ID, purchase date, and reason for refund
                </li>
                <li>
                  <strong>Wait for Review:</strong> Our team will review your request within 2-3 business days
                </li>
                <li>
                  <strong>Receive Decision:</strong> You will be notified of approval or denial via email
                </li>
                <li>
                  <strong>Get Refund:</strong> If approved, refund will be processed to your original payment method
                </li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Payment Gateway Policies</h2>
            <p className="text-gray-700">
              All payments are processed through Razorpay. Refunds are also processed via Razorpay and are subject to
              their policies and timelines. Razorpay may take 5-10 business days to process refunds depending on your
              bank or payment method.
            </p>
            <p className="text-gray-700 mt-4">
              For Razorpay-specific refund queries, you can contact Razorpay support at{' '}
              <a href="https://razorpay.com/support/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                https://razorpay.com/support/
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Disputes and Chargebacks</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>8.1 Contact Us First:</strong> Before initiating a chargeback with your bank or card issuer,
                please contact our support team. Most issues can be resolved quickly through direct communication.
              </p>
              <p>
                <strong>8.2 Chargeback Consequences:</strong> Initiating a chargeback without contacting us may result
                in account suspension pending investigation. False or unjustified chargebacks may lead to permanent
                account termination.
              </p>
              <p>
                <strong>8.3 Dispute Resolution:</strong> We are committed to resolving disputes fairly. If you are
                unsatisfied with our initial response, you may escalate to management for further review.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. No Refund Scenarios</h2>
            <p className="text-gray-700 mb-4">Refunds will <strong>NOT</strong> be provided in the following cases:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Credits used for workflow executions (unless due to platform technical failure)</li>
              <li>Refund requests made after 7 days of credit purchase</li>
              <li>Agent access purchases after first use</li>
              <li>User dissatisfaction with AI-generated results (quality is subjective)</li>
              <li>User error in providing incorrect input data</li>
              <li>Violation of Terms and Conditions or Acceptable Use Policy</li>
              <li>Account suspension or termination due to user misconduct</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Policy Updates</h2>
            <p className="text-gray-700">
              We reserve the right to modify this Refund and Cancellation Policy at any time. Changes will be posted on
              this page with an updated revision date. Purchases made after policy changes will be subject to the new
              terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Contact Information</h2>
            <div className="text-gray-700 space-y-2">
              <p>For refund requests or questions about this policy, contact us:</p>
              <p className="mt-4"><strong>Irizpro</strong></p>
              <p>Office No 03, 8th Floor, B-Wing, City Vista, Kharadi</p>
              <p>Downtown Road, near Ashoka Nagar</p>
              <p>Pune, Maharashtra 411014, India</p>
              <p className="mt-4">
                <strong>Email:</strong> <a href="mailto:nidhi@irizpro.in" className="text-blue-600 hover:underline">nidhi@irizpro.in</a>
              </p>
              <p>
                <strong>Phone:</strong> +91-9370754234, +91-8369834848, +91-8956953044
              </p>
              <p className="mt-4">
                <strong>Support Hours:</strong> Monday to Friday, 10:00 AM - 6:00 PM IST
              </p>
            </div>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center text-gray-600">
          <div className="flex justify-center gap-6 flex-wrap">
            <Link href="/privacy-policy" className="hover:text-blue-600">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-blue-600">Terms & Conditions</Link>
            <Link href="/contact" className="hover:text-blue-600">Contact Us</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
