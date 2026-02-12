'use client';

import { useCallback } from 'react';
import useRazorpayScript from '../../hooks/useRazorpayScript';

type CreditPackage = {
  id: string;
  name: string;
  price: number;
  credits: number;
};

const creditPackages: CreditPackage[] = [
  { id: 'starter', name: 'Starter', price: 1, credits: 50 },
  { id: 'growth', name: 'Growth', price: 499, credits: 200 },
  { id: 'pro', name: 'Pro', price: 999, credits: 500 },
];

export default function CreditsPageClient({
  user,
}: {
  user: { id: string; email: string };
}) {
  useRazorpayScript();

  const handleBuy = useCallback(
    async (pkg: CreditPackage) => {
      try {
        const key = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
        if (!key) {
          console.error('NEXT_PUBLIC_RAZORPAY_KEY_ID is missing');
          alert('Razorpay key is not configured. Check .env.local');
          return;
        }

        const res = await fetch('/api/razorpay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId: pkg.id,
            amount: pkg.price,
            credits: pkg.credits,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          console.error('Order creation error:', data);
          alert(data.error || 'Failed to create Razorpay order');
          return;
        }

        const RazorpayConstructor = (window as any).Razorpay;
        if (!RazorpayConstructor) {
          alert('Razorpay SDK failed to load.');
          return;
        }

        const options: any = {
          key,
          amount: pkg.price * 100,
          currency: 'INR',
          name: 'n8n Marketplace',
          description: `${pkg.credits} credits`,
          order_id: data.orderId,
          prefill: {
            email: user.email,
          },
          notes: {
            user_id: user.id,
            package_id: pkg.id,
          },
          handler: function (response: any) {
            console.log('Payment success', response);
            alert('Payment successful! Credits will be added in a few seconds.');
          },
        };

        const rzp = new RazorpayConstructor(options);
        rzp.open();
      } catch (err) {
        console.error(err);
        alert('Something went wrong starting payment');
      }
    },
    [user.id, user.email]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <h1 className="text-4xl font-bold mb-2">Buy Credits</h1>
      <p className="text-slate-300 mb-8 max-w-2xl">
        Purchase credits to run AI workflows (SEO blog generator, research
        agents, and more).
      </p>

      <div className="grid gap-6 md:grid-cols-3 max-w-5xl">
        {creditPackages.map((pkg) => (
          <div


          
            key={pkg.id}
            className="rounded-2xl bg-slate-900 border border-slate-800 p-6 flex flex-col justify-between shadow-lg"
          >
            <div>
              <h2 className="text-xl font-semibold mb-1">{pkg.name}</h2>
              <p className="text-slate-400 mb-4">
                {pkg.credits} credits • ideal for testing workflows
              </p>
              <div className="text-3xl font-bold mb-1">₹{pkg.price}</div>
              <div className="text-sm text-slate-400 mb-6">
                ~ ₹{(pkg.price / pkg.credits).toFixed(2)} per credit
              </div>
            </div>

            <button
              className="mt-4 w-full rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold py-3 transition"
              onClick={() => handleBuy(pkg)}
            >
              Buy {pkg.credits} Credits
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mt-10">
        Payments are processed securely via Razorpay. Credits are added to your
        account after the payment is confirmed (usually within a few seconds).
      </p>
    </div>
  );
}
