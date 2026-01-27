import Link from 'next/link';

export const metadata = {
  title: 'Terms & Conditions - AI Agent Marketplace',
  description: 'Terms and conditions for AI Agent Marketplace powered by Irizpro',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Back to Marketplace
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
          <p className="text-gray-600">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">1. Agreement to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing and using the AI Agent Marketplace operated by Irizpro, you accept and agree to be bound by
              these Terms and Conditions. If you do not agree to these terms, please do not use our marketplace.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">2. Service Description</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              The AI Agent Marketplace is a platform that allows users to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Browse and discover AI-powered workflow agents</li>
              <li>Purchase credits for accessing and executing agents</li>
              <li>Execute workflow agents by providing required inputs</li>
              <li>View execution history and results</li>
              <li>Manage account and credit balance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">3. Account Registration</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>3.1 Eligibility:</strong> You must be at least 18 years old to create an account and use our services.
                By registering, you represent that you meet this age requirement.
              </p>
              <p>
                <strong>3.2 Account Security:</strong> You are responsible for maintaining the confidentiality of your
                account credentials. Any activity under your account is your responsibility. Notify us immediately of
                any unauthorized access.
              </p>
              <p>
                <strong>3.3 Accurate Information:</strong> You agree to provide accurate and complete information during
                registration and to update it as necessary.
              </p>
              <p>
                <strong>3.4 Account Termination:</strong> We reserve the right to suspend or terminate accounts that
                violate these terms or engage in fraudulent activities.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">4. Credits and Payments</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>4.1 Credit Purchase:</strong> Credits are the virtual currency used to access and execute AI agents.
                Credits can be purchased through our payment gateway (Razorpay) using various payment methods.
              </p>
              <p>
                <strong>4.2 Pricing:</strong> Credit packages and agent pricing are displayed in Indian Rupees (INR) and
                other supported currencies. All prices include applicable taxes unless stated otherwise.
              </p>
              <p>
                <strong>4.3 Payment Processing:</strong> Payments are processed securely through Razorpay. By making a
                purchase, you agree to Razorpay's terms and conditions.
              </p>
              <p>
                <strong>4.4 Credit Validity:</strong> Purchased credits do not expire and remain in your account until used.
              </p>
              <p>
                <strong>4.5 Non-Transferable:</strong> Credits are non-transferable and can only be used by the account holder.
              </p>
              <p>
                <strong>4.6 Failed Payments:</strong> If a payment fails, credits will not be added to your account. Contact
                our support team if you were charged but credits were not added.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">5. Agent Access and Execution</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>5.1 Agent Purchase:</strong> Purchasing an agent grants you access to execute that specific
                workflow indefinitely. Each execution consumes credits based on the agent's pricing.
              </p>
              <p>
                <strong>5.2 Credit Deduction:</strong> Credits are deducted from your account when you initiate a workflow
                execution. If execution fails due to technical issues on our end, credits may be refunded at our discretion.
              </p>
              <p>
                <strong>5.3 Execution Results:</strong> We strive to provide accurate and reliable results, but we do not
                guarantee the accuracy, completeness, or usefulness of AI-generated outputs. Use results at your own discretion.
              </p>
              <p>
                <strong>5.4 Input Data:</strong> You are solely responsible for the data you input into workflow executions.
                Do not input sensitive, illegal, or harmful content.
              </p>
              <p>
                <strong>5.5 Service Availability:</strong> We aim for high availability but do not guarantee uninterrupted
                service. Scheduled maintenance and unexpected downtime may occur.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">6. Intellectual Property</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>6.1 Platform Ownership:</strong> All content, features, and functionality of the marketplace
                (including but not limited to text, graphics, logos, software) are owned by Irizpro and protected by
                copyright, trademark, and other intellectual property laws.
              </p>
              <p>
                <strong>6.2 Agent Workflows:</strong> The AI agent workflows and their underlying logic are proprietary
                to Irizpro or our partners. You may not copy, reverse-engineer, or redistribute them.
              </p>
              <p>
                <strong>6.3 User Content:</strong> You retain ownership of any input data you provide. By using our
                services, you grant us a license to process this data solely for providing the requested services.
              </p>
              <p>
                <strong>6.4 Output Usage:</strong> You may use the outputs generated from workflow executions for your
                personal or commercial purposes, subject to applicable laws and third-party rights.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">7. Prohibited Activities</h2>
            <p className="text-gray-700 mb-4">You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Use the marketplace for any illegal or unauthorized purpose</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights of others</li>
              <li>Transmit viruses, malware, or harmful code</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Abuse, harass, or harm other users</li>
              <li>Use automated tools to scrape or extract data from the platform</li>
              <li>Resell or redistribute credits or agent access</li>
              <li>Create multiple accounts to abuse promotions or services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">8. Refunds and Cancellations</h2>
            <p className="text-gray-700">
              Please refer to our <Link href="/refund-policy" className="text-blue-600 hover:underline">Refund Policy</Link> for
              detailed information about refunds, cancellations, and credit adjustments.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">9. Limitation of Liability</h2>
            <div className="space-y-4 text-gray-700">
              <p>
                <strong>9.1 Service "As Is":</strong> The marketplace is provided "as is" without warranties of any kind,
                either express or implied, including but not limited to warranties of merchantability or fitness for a
                particular purpose.
              </p>
              <p>
                <strong>9.2 No Liability for Damages:</strong> Irizpro shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages arising from your use of the marketplace, including but not
                limited to loss of profits, data, or business opportunities.
              </p>
              <p>
                <strong>9.3 Maximum Liability:</strong> Our total liability for any claim arising from your use of the
                marketplace shall not exceed the amount you paid for credits in the last 12 months.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">10. Indemnification</h2>
            <p className="text-gray-700">
              You agree to indemnify and hold Irizpro harmless from any claims, damages, liabilities, and expenses
              (including legal fees) arising from your use of the marketplace, violation of these terms, or infringement
              of any third-party rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">11. Privacy</h2>
            <p className="text-gray-700">
              Your use of the marketplace is also governed by our <Link href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
              Please review it to understand how we collect, use, and protect your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">12. Modifications to Terms</h2>
            <p className="text-gray-700">
              We reserve the right to modify these Terms and Conditions at any time. Changes will be posted on this page
              with an updated revision date. Continued use of the marketplace after changes constitutes acceptance of
              the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">13. Modifications to Service</h2>
            <p className="text-gray-700">
              We may modify, suspend, or discontinue any aspect of the marketplace at any time, including agent
              availability, pricing, or features. We will provide reasonable notice for significant changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">14. Governing Law and Jurisdiction</h2>
            <p className="text-gray-700">
              These Terms and Conditions are governed by the laws of India. Any disputes arising from these terms or
              your use of the marketplace shall be subject to the exclusive jurisdiction of courts in Pune, Maharashtra, India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">15. Contact Information</h2>
            <div className="text-gray-700 space-y-2">
              <p>For questions about these Terms and Conditions, please contact us:</p>
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
            </div>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center text-gray-600">
          <div className="flex justify-center gap-6 flex-wrap">
            <Link href="/privacy-policy" className="hover:text-blue-600">Privacy Policy</Link>
            <Link href="/refund-policy" className="hover:text-blue-600">Refund Policy</Link>
            <Link href="/contact" className="hover:text-blue-600">Contact Us</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
