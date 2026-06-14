async function testInvalid() {
  try {
    const res = await fetch("http://localhost:5173/api/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: null, // Invalid amount
        currency: "INR",
        receipt: "rcpt_test_123",
      }),
    });

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response Text:", text);
  } catch (error) {
    console.error("Fetch failed:", error);
  }
}

testInvalid();
