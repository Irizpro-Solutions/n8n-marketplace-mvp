import Link from 'next/link';

export const metadata = {
  title: 'Contact Us - AI Agent Marketplace',
  description: 'Get in touch with Irizpro for support and inquiries',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-blue-600 hover:text-blue-700 mb-4 inline-block">
            ← Back to Marketplace
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Contact Us</h1>
          <p className="text-gray-600">We're here to help! Reach out to us for any questions or support.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">Get in Touch</h2>

            <div className="space-y-6">
              {/* Office Address */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Office Address
                </h3>
                <p className="text-gray-700 leading-relaxed ml-7">
                  Office No 03, 8th Floor, B-Wing<br />
                  City Vista, Kharadi<br />
                  Downtown Road, near Ashoka Nagar<br />
                  Pune, Maharashtra 411014<br />
                  India
                </p>
              </div>

              {/* Email */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </h3>
                <a href="mailto:nidhi@irizpro.in" className="text-blue-600 hover:underline ml-7">
                  nidhi@irizpro.in
                </a>
              </div>

              {/* Phone */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Phone
                </h3>
                <div className="ml-7 space-y-1">
                  <p>
                    <a href="tel:+919370754234" className="text-blue-600 hover:underline">
                      +91-9370754234
                    </a>
                  </p>
                  <p>
                    <a href="tel:+918369834848" className="text-blue-600 hover:underline">
                      +91-8369834848
                    </a>
                  </p>
                  <p>
                    <a href="tel:+918956953044" className="text-blue-600 hover:underline">
                      +91-8956953044
                    </a>
                  </p>
                </div>
              </div>

              {/* Business Hours */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Support Hours
                </h3>
                <p className="text-gray-700 ml-7">
                  Monday to Friday<br />
                  10:00 AM - 6:00 PM IST
                </p>
              </div>
            </div>
          </div>

          {/* Support Topics */}
          <div className="bg-white rounded-lg shadow-sm p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">How Can We Help?</h2>

            <div className="space-y-4">
              <div className="border-l-4 border-blue-600 pl-4 py-2">
                <h3 className="font-medium text-gray-900 mb-1">Technical Support</h3>
                <p className="text-gray-600 text-sm">
                  Issues with agent execution, platform errors, or technical difficulties
                </p>
              </div>

              <div className="border-l-4 border-green-600 pl-4 py-2">
                <h3 className="font-medium text-gray-900 mb-1">Payment & Billing</h3>
                <p className="text-gray-600 text-sm">
                  Questions about credit purchases, refunds, or payment issues
                </p>
              </div>

              <div className="border-l-4 border-purple-600 pl-4 py-2">
                <h3 className="font-medium text-gray-900 mb-1">Account Issues</h3>
                <p className="text-gray-600 text-sm">
                  Login problems, account access, or password reset assistance
                </p>
              </div>

              <div className="border-l-4 border-orange-600 pl-4 py-2">
                <h3 className="font-medium text-gray-900 mb-1">Agent Information</h3>
                <p className="text-gray-600 text-sm">
                  Questions about specific agents, features, or capabilities
                </p>
              </div>

              <div className="border-l-4 border-red-600 pl-4 py-2">
                <h3 className="font-medium text-gray-900 mb-1">Partnerships & Business</h3>
                <p className="text-gray-600 text-sm">
                  Collaboration opportunities, custom solutions, or enterprise plans
                </p>
              </div>

              <div className="border-l-4 border-gray-600 pl-4 py-2">
                <h3 className="font-medium text-gray-900 mb-1">General Inquiries</h3>
                <p className="text-gray-600 text-sm">
                  Any other questions or feedback about our platform
                </p>
              </div>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Response Time</h3>
              <p className="text-blue-800 text-sm">
                We typically respond to all inquiries within 24-48 hours during business days.
                For urgent technical issues, please call our support line.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-8 bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Answers</h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">How do I purchase credits?</h3>
              <p className="text-gray-700">
                Navigate to the Browse page, select an agent, and click "Purchase". You can buy credits along with
                agent access through our secure Razorpay payment gateway.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">What payment methods are accepted?</h3>
              <p className="text-gray-700">
                We accept all major credit/debit cards, UPI, net banking, and wallets through Razorpay. All transactions
                are secure and encrypted.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Can I get a refund?</h3>
              <p className="text-gray-700">
                Yes, unused credits can be refunded within 7 days of purchase. Please see our{' '}
                <Link href="/refund-policy" className="text-blue-600 hover:underline">Refund Policy</Link> for
                detailed terms and conditions.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">How do credits work?</h3>
              <p className="text-gray-700">
                Credits are used to execute AI agent workflows. Each agent has a specific credit cost per execution.
                Credits do not expire and can be used across any agents you have purchased access to.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Is my data secure?</h3>
              <p className="text-gray-700">
                Yes, we take data security seriously. All data is transmitted over encrypted connections, and we follow
                industry best practices. Read our{' '}
                <Link href="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link> for more details.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Links */}
        <div className="mt-8 text-center text-gray-600">
          <div className="flex justify-center gap-6 flex-wrap">
            <Link href="/privacy-policy" className="hover:text-blue-600">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-blue-600">Terms & Conditions</Link>
            <Link href="/refund-policy" className="hover:text-blue-600">Refund Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
