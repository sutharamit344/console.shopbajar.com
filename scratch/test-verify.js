async function testVerify() {
  try {
    const res = await fetch("http://localhost:5173/api/verify-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        razorpay_order_id: "order_123",
        razorpay_payment_id: "pay_123",
        razorpay_signature: "sig_123",
      }),
    });

    console.log("Verify Status:", res.status);
    console.log("Verify Response Text:", await res.text());
  } catch (error) {
    console.error("Verify failed:", error);
  }
}

testVerify();
