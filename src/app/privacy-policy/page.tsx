import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - AI Agent Marketplace',
  description: 'Privacy policy for AI Agent Marketplace powered by Irizpro',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Back to Marketplace
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-600">Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm p-8 space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              Welcome to the AI Agent Marketplace, operated by Irizpro. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you use our marketplace platform for purchasing credits and executing AI-powered
              workflow agents.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium text-gray-800 mb-2">Account Information</h3>
                <p className="text-gray-700">
                  When you create an account, we collect your email address, name, and password (securely hashed).
                  This information is used for authentication and account management.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-gray-800 mb-2">Payment Information</h3>
                <p className="text-gray-700">
                  Payment transactions are processed through Razorpay. We store transaction IDs, order IDs, and payment
                  status for record-keeping. Your credit card information is not stored on our servers and is handled
                  directly by Razorpay as per their security standards.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-gray-800 mb-2">Usage Data</h3>
                <p className="text-gray-700">
                  We collect information about your interactions with the marketplace, including purchased agents,
                  credit balance, workflow executions, and execution history. This helps us provide and improve our services.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium text-gray-800 mb-2">Workflow Input Data</h3>
                <p className="text-gray-700">
                  When you execute AI agent workflows, we temporarily process the input data you provide. This data is
                  used solely for executing the requested workflow and is stored only for execution history purposes.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>To create and manage your marketplace account</li>
              <li>To process credit purchases and workflow executions</li>
              <li>To provide customer support and respond to inquiries</li>
              <li>To send transaction confirmations and account notifications</li>
              <li>To improve our platform and develop new features</li>
              <li>To detect and prevent fraud or unauthorized activities</li>
              <li>To comply with legal obligations and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Sharing and Disclosure</h2>
            <p className="text-gray-700 mb-4">
              We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>Payment Processing:</strong> With Razorpay for processing payments securely</li>
              <li><strong>Workflow Execution:</strong> With n8n platform for executing AI agent workflows</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights and safety</li>
              <li><strong>Business Transfers:</strong> In connection with any merger, sale, or transfer of company assets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Cookies and Tracking</h2>
            <p className="text-gray-700">
              We use cookies and similar technologies for authentication and session management. Essential cookies are
              required for the platform to function properly. We do not use tracking cookies for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Security</h2>
            <p className="text-gray-700">
              We implement industry-standard security measures to protect your personal information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
              <li>Encrypted data transmission (HTTPS/SSL)</li>
              <li>Secure password hashing</li>
              <li>Regular security audits and updates</li>
              <li>Access controls and authentication mechanisms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Retention</h2>
            <p className="text-gray-700">
              We retain your account information and transaction history for as long as your account is active or as
              needed to provide services. You can request account deletion at any time, though we may retain certain
              information for legal or business purposes (e.g., transaction records for tax compliance).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights</h2>
            <p className="text-gray-700 mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>Access and review your personal information</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Export your data in a portable format</li>
              <li>Opt-out of marketing communications (if any)</li>
              <li>Withdraw consent for data processing where applicable</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
            <p className="text-gray-700">
              Our marketplace integrates with third-party services (Razorpay for payments, n8n for workflows, Supabase
              for authentication). These services have their own privacy policies, and we encourage you to review them:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-4">
              <li>Razorpay Privacy Policy: <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://razorpay.com/privacy/</a></li>
              <li>Supabase Privacy Policy: <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://supabase.com/privacy</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Children's Privacy</h2>
            <p className="text-gray-700">
              Our marketplace is not intended for users under the age of 18. We do not knowingly collect information
              from children. If you believe a child has provided us with personal information, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to This Policy</h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated
              revision date. Continued use of the marketplace after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="text-gray-700 space-y-2">
              <p><strong>Irizpro</strong></p>
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
            <Link href="/terms" className="hover:text-blue-600">Terms & Conditions</Link>
            <Link href="/refund-policy" className="hover:text-blue-600">Refund Policy</Link>
            <Link href="/contact" className="hover:text-blue-600">Contact Us</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
