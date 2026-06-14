const getSessionCode = (sessionId: string) => {
  if (!sessionId) return "";
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash += sessionId.charCodeAt(i);
  }
  return ((hash % 90) + 10).toString();
};

const getGuestNames = (session: any) => {
  const code = getSessionCode(session.id || session.sessionId);
  const codeSuffix = code ? ` [#${code}]` : "";
  if (session.guests && Object.keys(session.guests).length > 0) {
    return (
      Object.values(session.guests)
        .map((g: any) => g.name)
        .join(", ") + codeSuffix
    );
  }
  return (session.customerName || "Guest") + codeSuffix;
};

const getGuestPhones = (session: any) => {
  if (session.guests && Object.keys(session.guests).length > 0) {
    return Object.values(session.guests)
      .map((g: any) => g.phone)
      .filter(Boolean)
      .join(", ");
  }
  return session.customerPhone || "";
};

export function printPosSlip(shop: any, session: any, sessionOrders: any[]) {
  const printWindow = window.open("", "_blank", "width=420,height=700");
  if (!printWindow) return;

  const dateObj = new Date();
  const dateStr = dateObj.toLocaleDateString("en-IN");
  const timeStr = dateObj.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  // Consolidate items
  const consolidatedItems: Record<string, any> = {};
  sessionOrders.forEach((order) => {
    if (order.status === "cancelled") return;
    order.items?.forEach((item: any) => {
      const price = parseFloat(item.price || 0);
      if (consolidatedItems[item.name]) {
        consolidatedItems[item.name].qty += parseInt(item.qty || 1);
      } else {
        consolidatedItems[item.name] = {
          name: item.name,
          price: price,
          qty: parseInt(item.qty || 1),
        };
      }
    });
  });

  const itemsArray = Object.values(consolidatedItems) as any[];
  const finalTotal = itemsArray.reduce(
    (sum: number, item: any) => sum + item.price * item.qty,
    0
  );

  const itemRows = itemsArray
    .map((item) => {
      const lineTotal = item.qty * item.price;
      return `
      <div class="item">
        <div class="item-top">
          <span class="item-name">${item.name || "Item"}</span>
          <span class="item-total">Rs ${lineTotal.toFixed(0)}</span>
        </div>
        <div class="item-meta">${item.qty} x Rs ${item.price.toFixed(0)}</div>
      </div>
    `;
    })
    .join("");

  const guestName = getGuestNames(session);
  const guestPhone = getGuestPhones(session);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>POS Slip - ${shop.name} - ${session.tableName}</title>
      <style>
        @page { size: 80mm auto; margin: 6mm; }
        body {
          font-family: "Courier New", monospace;
          color: #111;
          margin: 0;
          padding: 0;
          font-size: 12px;
          line-height: 1.4;
        }
        .slip {
          width: 72mm;
          margin: 0 auto;
        }
        .center { text-align: center; }
        .title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .muted {
          color: #444;
          font-size: 11px;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 10px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          margin: 2px 0;
        }
        .label {
          color: #444;
        }
        .item {
          padding: 6px 0;
          border-bottom: 1px dashed #ccc;
        }
        .item-top {
          display: flex;
          justify-content: space-between;
          gap: 8px;
          align-items: flex-start;
        }
        .item-name {
          font-weight: 700;
          word-break: break-word;
        }
        .item-total {
          font-weight: 700;
          white-space: nowrap;
        }
        .item-meta {
          color: #444;
          font-size: 11px;
          margin-top: 2px;
        }
        .grand-total {
          font-size: 15px;
          font-weight: 700;
          margin-top: 8px;
        }
        .footer {
          margin-top: 15px;
          text-align: center;
          font-size: 11px;
        }
        .paid-stamp {
          border: 2px solid #000;
          color: #000;
          font-size: 14px;
          font-weight: bold;
          padding: 4px 8px;
          margin: 12px auto;
          width: fit-content;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        @media print {
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="slip">
        <div class="center">
          <div class="title">${shop.name}</div>
          <div class="muted">${shop.category || "Store"}</div>
          ${shop.phone ? `<div class="muted">Ph: ${shop.phone}</div>` : ""}
          <div class="muted">${[shop.area, shop.city].filter(Boolean).join(", ")}</div>
        </div>

        <div class="divider"></div>

        <div class="row"><span class="label">Table</span><span><strong>${session.tableName || "Table"}</strong></span></div>
        <div class="row"><span class="label">Session ID</span><span>#${session.id?.substring(0, 6).toUpperCase() || "-"}</span></div>
        <div class="row"><span class="label">Date</span><span>${dateStr}</span></div>
        <div class="row"><span class="label">Time</span><span>${timeStr}</span></div>

        <div class="divider"></div>

        <div class="row"><span class="label">Customer</span><span>${guestName || "Guest"}</span></div>
        ${guestPhone ? `<div class="row"><span class="label">Phone</span><span>${guestPhone}</span></div>` : ""}

        <div class="divider"></div>

        ${itemRows || '<div class="center muted">No items ordered</div>'}

        <div class="divider"></div>

        <div class="row grand-total">
          <span>TOTAL AMOUNT</span>
          <span>Rs ${finalTotal.toFixed(0)}</span>
        </div>

        <div class="paid-stamp">PAID</div>

        <div class="footer">
          <div>Thank you for dining with us!</div>
          <div>Powered by ShopBajar</div>
        </div>
      </div>
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() { window.close(); };
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
