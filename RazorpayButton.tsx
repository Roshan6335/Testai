import React, { useState } from 'react';

interface RazorpayButtonProps {
  amountInPaise: number; // e.g. 29900 for ₹299
  planName: string;
  userEmail: string;
  userName: string;
  onSuccess: (response: any) => void;
}

export default function RazorpayButton({ amountInPaise, planName, userEmail, userName, onSuccess }: RazorpayButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePayment = async () => {
    setIsLoading(true);
    
    // In a real production app, you MUST call your backend to create an Order ID first.
    // Example: const orderResponse = await fetch('/api/create-razorpay-order', { ... })
    // const { id: order_id } = await orderResponse.json();

    const options = {
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_YOUR_TEST_KEY', // Enter your Razorpay Test Key here
      amount: amountInPaise.toString(),
      currency: "INR",
      name: "Keryo AI",
      description: `Upgrade to ${planName}`,
      image: "https://keryo.ai/logo.png",
      // order_id: order_id, // REQUIRED IN PRODUCTION!
      handler: function (response: any) {
        // Payment Succeeded!
        // You would typically verify the signature on your backend here
        onSuccess(response);
      },
      prefill: {
        name: userName,
        email: userEmail,
      },
      theme: {
        color: "#4f46e5", // Indigo-600 to match Keryo branding
      },
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
        console.error("Payment failed", response.error);
        alert(`Payment failed: ${response.error.description}`);
      });

      rzp.open();
    } catch (error) {
      console.error("Razorpay SDK not loaded", error);
      alert("Payment system is currently unavailable. Please check your internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={isLoading}
      className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl transition-all disabled:opacity-50"
    >
      {isLoading ? 'Loading Checkout...' : `Upgrade to ${planName} — ₹${(amountInPaise / 100).toFixed(2)}/mo`}
    </button>
  );
}
