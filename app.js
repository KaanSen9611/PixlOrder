const $ = (s) => document.querySelector(s),
  E = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  M = (n) => "₺" + (+n || 0).toFixed(2),
  A = async (u, o = {}) => {
    o.headers =
      o.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json", ...(o.headers || {}) };
    let r = await fetch(u, o),
      d = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(d.error || "Request failed");
    return d;
  },
  T = (m) => {
    let x = $("#toast");
    if (x) {
      x.textContent = m;
      x.classList.add("show");
      setTimeout(() => x.classList.remove("show"), 2500);
    }
  },
  S = window.io ? io() : null;
if ($("#products")) customer();
if ($(".kgrid")) kitchen();
if ($("#admin")) admin();
function pop(html) {
  let d = document.createElement("div");
  d.className = "modal-back";
  d.innerHTML = `<div class="modal"><button id="x" style="float:right">×</button>${html}</div>`;
  document.body.append(d);
  $("#x").onclick = () => d.remove();
  d.onclick = (e) => {
    if (e.target === d) d.remove();
  };
  return d;
}
async function customer() {
  let [ps, cs, st] = await Promise.all([
      A("/api/products"),
      A("/api/categories"),
      A("/api/settings"),
    ]),
    cart = JSON.parse(localStorage.getItem("pixl-cart") || "[]"),
    cat = "All";
  const save = () => {
    localStorage.setItem("pixl-cart", JSON.stringify(cart));
    $("#count").textContent = cart.reduce((n, x) => n + x.qty, 0);
  };
  function draw() {
    $("#filters").innerHTML = ["All", ...cs.map((x) => x.name)]
      .map(
        (x) =>
          `<button class="${cat === x ? "active" : ""}" data-c="${E(x)}">${E(x)}</button>`,
      )
      .join("");
    let q = $("#search").value.toLowerCase(),
      rows = ps.filter(
        (x) =>
          (cat === "All" || x.category === cat) &&
          x.name.toLowerCase().includes(q),
      );
    $("#products").innerHTML =
      rows
        .map(
          (p, i) =>
            `<article class="card product"><div class="product-visual">${p.image ? `<img src="${E(p.image)}" alt="${E(p.name)}" style="width:100%;height:100%;object-fit:cover">` : ["☕", "🥐", "🍵", "🧁", "🥪"][i % 5]}</div><div class="product-body"><span class="tag">${E(p.category || "Fresh daily")}</span><h3>${E(p.name)}</h3><p>${E(p.description)}</p><div class="product-foot"><b>${M(p.price)}</b><button class="add" data-add="${p.id}" ${p.available && p.stock_available ? "" : "disabled"}>${p.available && p.stock_available ? "+ Add" : "Sold out"}</button></div></div></article>`,
        )
        .join("") || "<p>No items found.</p>";
  }
  $("#filters").onclick = (e) => {
    if (e.target.dataset.c) {
      cat = e.target.dataset.c;
      draw();
    }
  };
  $("#search").oninput = draw;
  function customize(p, index = null) {
    if (!p) return;
    const current = index === null ? [] : cart[index].options || [];
    let html = `<span class="tag">MAKE IT YOURS</span><h2>${E(p.name)}</h2><p>${E(p.description)}</p>`;
    for (let [k, items] of Object.entries(p.options || {}))
      if (Array.isArray(items) && items.length) {
        let multi = ["extras", "toppings"].includes(k),
          chosen = current.filter(
            (o) =>
              o.group === k ||
              (!o.group && items.some((x) => x.name === o.name)),
          );
        html += `<div class="field"><label>${E(k[0].toUpperCase() + k.slice(1))}</label>${multi ? items.map((x) => `<label><input type="checkbox" data-o data-g="${E(k)}" value="${E(x.name)}" data-p="${x.price}" ${chosen.some((o) => o.name === x.name) ? "checked" : ""}> ${E(x.name)} (+${M(x.price)})</label>`).join("") : `<select data-o data-g="${E(k)}">${items.map((x, j) => `<option value="${E(x.name)}" data-p="${x.price}" ${chosen.some((o) => o.name === x.name) || (!chosen.length && j === 0) ? "selected" : ""}>${E(x.name)}${x.price ? " +" + M(x.price) : ""}</option>`).join("")}</select>`}</div>`;
      }
    html += `<button class="btn" id="addOne">${index === null ? "Add to bag" : "Save changes"} · ${M(p.price)}</button>`;
    let d = pop(html);
    d.querySelector("#addOne").onclick = () => {
      let options = [
          ...d.querySelectorAll("[data-o]:checked,select[data-o]"),
        ].map((x) => ({
          group: x.dataset.g,
          name: x.value,
          price: +(x.selectedOptions?.[0]?.dataset.p || x.dataset.p || 0),
        })),
        item = {
          id: p.id,
          name: p.name,
          price: p.price + options.reduce((a, x) => a + x.price, 0),
          options,
          qty: index === null ? 1 : cart[index].qty,
        };
      if (index === null) cart.push(item);
      else cart[index] = item;
      save();
      d.remove();
      T(index === null ? "Added to your bag" : "Customizations updated");
    };
  }
  $("#products").onclick = (e) => {
    let p = ps.find((x) => x.id == e.target.dataset.add);
    if (p) customize(p);
  };
  save();
  draw();
  $("#cartOpen").onclick = bag;
  function bag() {
    let sub = cart.reduce((a, x) => a + x.price * x.qty, 0),
      tax = (sub * (+st.taxPercent || 0)) / 100,
      d = pop(
        `<span class="tag">YOUR BAG</span><h2>Something lovely.</h2>${cart.map((x, i) => `<div class="item-row"><div><b>${E(x.name)}</b><small class="muted" style="display:block">${E(x.options.map((a) => a.name).join(" · "))}</small></div><span>${M(x.price * x.qty)}</span><div><button data-edit="${i}">Edit</button> <button data-i="${i}" data-d="-1">−</button>${x.qty}<button data-i="${i}" data-d="1">+</button><button data-i="${i}" data-r="1">×</button></div></div>`).join("") || '<p class="muted">Your bag is empty.</p>'}${cart.length ? `<p>Subtotal <b style="float:right">${M(sub)}</b></p><p>Tax <b style="float:right">${M(tax)}</b></p><h3>Total ${M(sub + tax)}</h3><button id="clear" class="btn light">Clear bag</button> <button id="checkout" class="btn">Checkout</button>` : ""}`,
      );
    d.querySelectorAll("[data-edit]").forEach(
      (b) =>
        (b.onclick = () => {
          let i = +b.dataset.edit,
            p = ps.find((x) => x.id === cart[i].id);
          d.remove();
          customize(p, i);
        }),
    );
    d.querySelectorAll("[data-i]").forEach(
      (b) =>
        (b.onclick = () => {
          let i = +b.dataset.i;
          if (b.dataset.r) cart.splice(i, 1);
          else cart[i].qty = Math.max(1, cart[i].qty + +b.dataset.d);
          save();
          d.remove();
          bag();
        }),
    );
    d.querySelector("#clear")?.addEventListener("click", () => {
      cart = [];
      save();
      d.remove();
      bag();
    });
    d.querySelector("#checkout")?.addEventListener("click", () => checkout());
  }
  function checkout() {
    let sub = cart.reduce((a, x) => a + x.price * x.qty, 0),
      d = pop(
        `<span class="tag">ALMOST THERE</span><h2>Finish your order.</h2><div class="card panel">${cart.map((x) => `<p>${x.qty} × ${E(x.name)} <span style="float:right">${M(x.price * x.qty)}</span></p>`).join("")}<hr><p>Subtotal <span style="float:right">${M(sub)}</span></p><p>Tax <span style="float:right">${M((sub * (+st.taxPercent || 0)) / 100)}</span></p><b>Total ${M(sub + (sub * (+st.taxPercent || 0)) / 100)}</b></div><form id="cf"><label class="field">Your name<input name="customer" required maxlength="80"></label><label class="field">Order type<select name="type" id="type"><option>Takeaway</option><option>Dine-in</option></select></label><label class="field" id="table" style="display:none">Table number (optional)<input name="tableNo" maxlength="10"></label><label class="field">Payment<select name="payment"><option>Pay at counter</option><option>Cash</option><option>Simulated card</option></select></label><p class="muted">Demo only. No card data is requested.</p><label class="field">Order note<textarea name="note" maxlength="500"></textarea></label><button class="btn">Place order</button></form>`,
      );
    d.querySelector("#type").onchange = (e) =>
      (d.querySelector("#table").style.display =
        e.target.value === "Dine-in" ? "grid" : "none");
    d.querySelector("#cf").onsubmit = async (e) => {
      e.preventDefault();
      let f = new FormData(e.target);
      try {
        let o = await A("/api/orders", {
          method: "POST",
          body: JSON.stringify({
            customer: f.get("customer"),
            type: f.get("type"),
            tableNo: f.get("tableNo"),
            payment: f.get("payment"),
            note: f.get("note"),
            requestKey: crypto.randomUUID(),
            items: cart.map((x) => ({
              id: x.id,
              quantity: x.qty,
              customization: x.options,
            })),
          }),
        });
        cart = [];
        save();
        d.remove();
        let z = pop(
          `<div style="text-align:center;padding:20px"><div style="font-size:50px">✦</div><span class="tag">ORDER RECEIVED</span><h2>Thank you, ${E(o.customer)}.</h2><p>Order <b>${E(o.number)}</b> · ready in about ${E(st.prepTime)} min</p><p>Status: <b id="os">${E(o.status)}</b></p></div>`,
        );
        S?.on("order-status-changed", (u) => {
          if (u.id === o.id && z.querySelector("#os"))
            z.querySelector("#os").textContent = u.status;
        });
      } catch (x) {
        T(x.message);
      }
    };
  }
  $("#trackBtn").onclick = async () => {
    try {
      let list = await A("/api/orders"),
        o = list.find(
          (x) =>
            x.number.toLowerCase() ===
            $("#trackNumber").value.trim().toLowerCase(),
        );
      $("#trackResult").innerHTML = o
        ? `<span class="tag">${E(o.number)} · ${E(o.status)}</span>`
        : '<p class="muted">Order not found.</p>';
    } catch (e) {
      T(e.message);
    }
  };
  S?.on("connect", async () => {
    try {
      [ps, cs, st] = await Promise.all([
        A("/api/products"),
        A("/api/categories"),
        A("/api/settings"),
      ]);
      draw();
    } catch {}
  });
  S?.on("product-updated", async () => {
    ps = await A("/api/products");
    draw();
  });
  S?.on("categories-updated", async () => {
    cs = await A("/api/categories");
    draw();
  });
  S?.on("order-status-changed", (o) => {
    if ($("#trackNumber").value.toUpperCase() === o.number)
      $("#trackResult").innerHTML =
        `<span class="tag">${E(o.number)} · ${E(o.status)}</span>`;
  });
}
async function kitchen() {
  let orders = [],
    snd = true;
  async function load() {
    orders = await A("/api/orders");
    draw();
  }
  function draw() {
    for (let [status, id, count] of [
      ["Received", "new", "ncount"],
      ["Preparing", "preparing", "pcount"],
      ["Ready", "ready", "rcount"],
    ]) {
      let a = orders.filter((o) => o.status === status);
      $("#" + count).textContent = a.length;
      $("#" + id).innerHTML =
        a
          .map((o) => {
            let age = Math.floor((Date.now() - new Date(o.created_at)) / 60000);
            return `<article class="kcard ${status === "Preparing" ? "prep" : status === "Ready" ? "ready" : ""} ${age > 12 ? "late" : ""}"><header><h3>${E(o.number)}</h3><b>${age}m</b></header><p>${E(o.customer)} · ${E(o.type)} ${o.table_no ? "· Table " + E(o.table_no) : ""}</p><small>${new Date(o.created_at).toLocaleTimeString()}</small><ul>${o.items
              .map(
                (i) =>
                  `<li><b>${i.quantity}× ${E(i.name)}</b>${
                    i.customization
                      ? "<br><small>" +
                        E(
                          JSON.parse(i.customization)
                            .map((x) => x.name)
                            .join(", "),
                        ) +
                        "</small>"
                      : ""
                  }</li>`,
              )
              .join(
                "",
              )}</ul>${o.note ? "<p>📝 " + E(o.note) + "</p>" : ""}<button class="kbtn action" data-id="${o.id}" data-status="${status === "Received" ? "Preparing" : status === "Preparing" ? "Ready" : "Completed"}">${status === "Received" ? "Start preparing" : status === "Preparing" ? "Mark ready" : "Complete"}</button></article>`;
          })
          .join("") || '<div class="empty">No orders</div>';
    }
  }
  document.body.onclick = async (e) => {
    if (e.target.dataset.status) {
      if (
        e.target.dataset.status === "Cancelled" &&
        !confirm("Cancel this order?")
      )
        return;
      try {
        await A("/api/orders/" + e.target.dataset.id + "/status", {
          method: "PATCH",
          body: JSON.stringify({ status: e.target.dataset.status }),
        });
      } catch (x) {
        T(x.message);
      }
    }
  };
  $("#sound").onclick = () => {
    snd = !snd;
    $("#sound").textContent = "♫ Sound " + (snd ? "on" : "off");
  };
  $("#full").onclick = () =>
    document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
  setInterval(
    () => ($("#clock").textContent = new Date().toLocaleTimeString()),
    1000,
  );
  S?.on("connect", () => {
    $("#conn").textContent = "● Connected";
    load();
  });
  S?.on("disconnect", () => ($("#conn").textContent = "● Reconnecting"));
  S?.on("new-order", () => {
    if (snd)
      try {
        let a = new AudioContext(),
          o = a.createOscillator();
        o.connect(a.destination);
        o.start();
        o.stop(a.currentTime + 0.2);
      } catch {}
    load();
  });
  S?.on("order-status-changed", load);
  load().catch((e) => T(e.message));
  setInterval(() => orders.length && draw(), 30000);
}
async function admin() {
  let section = "Overview",
    range = "7",
    products = [],
    cats = [],
    charts = [];
  const root = $("#admin");
  function login() {
    root.innerHTML = `<form class="card login" id="login"><b class="brand">PIXL CAFE<small>ADMIN STUDIO</small></b><h1>Welcome back.</h1><label class="field">Username<input name="u" value="admin"></label><label class="field">Password<input name="p" type="password" required></label><button class="btn">Sign in</button><p class="muted">Set PIXL_ADMIN_PASSWORD before first launch. See README for first-run setup.</p></form>`;
    $("#login").onsubmit = async (e) => {
      e.preventDefault();
      let f = new FormData(e.target);
      try {
        await A("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username: f.get("u"), password: f.get("p") }),
        });
        layout();
      } catch (x) {
        T(x.message);
      }
    };
  }
  async function layout() {
    let s = await A("/api/auth/session");
    if (!s.authenticated) return login();
    root.innerHTML = `<div class="admin-layout"><aside class="sidebar"><a class="brand" href="/">PIXL CAFE<small>ADMIN STUDIO</small></a><nav class="side-nav">${["Overview", "Orders", "Products", "Categories", "Inventory", "Analytics", "Settings"].map((x) => `<button data-s="${x}" class="${section === x ? "active" : ""}">${x}</button>`).join("")}</nav><button id="logout" class="btn light">Sign out</button></aside><main class="admin-main"><header class="admin-top"><div><span class="tag">PIXL ORDER / ${section.toUpperCase()}</span><h1>${section}</h1></div><a class="pill" href="/">View cafe ↗</a></header><div id="view"></div></main></div>`;
    root.querySelectorAll("[data-s]").forEach(
      (b) =>
        (b.onclick = () => {
          section = b.dataset.s;
          layout();
        }),
    );
    $("#logout").onclick = async () => {
      await A("/api/auth/logout", { method: "POST" });
      login();
    };
    render();
  }
  function metric(a, b) {
    return `<section class="card metric"><span>${a}</span><strong>${b}</strong></section>`;
  }
  function detail(html) {
    return pop(html);
  }
  async function render() {
    let v = $("#view");
    try {
      if (section === "Overview") {
        let a = await A("/api/analytics?range=1");
        v.innerHTML = `<div class="metrics">${metric("Today's revenue", M(a.revenue))}${metric("Total orders", a.orders.length)}${metric("Average order", M(a.average))}${metric("Active orders", a.active)}</div><div class="admin-grid"><section class="card panel"><h3>Today's pulse</h3><p>${a.completed} completed orders</p><b>Top pick · ${E(a.best)}</b></section><section class="card panel"><h3>Quick links</h3><button class="btn" data-go="Orders">View orders</button> <button class="btn light" data-go="Products">Manage menu</button></section></div>`;
        v.querySelectorAll("[data-go]").forEach(
          (b) =>
            (b.onclick = () => {
              section = b.dataset.go;
              layout();
            }),
        );
      } else if (section === "Orders") {
        let os = await A("/api/orders");
        v.innerHTML = `<input id="q" class="search-admin" placeholder="Search customer or order"><select id="f" class="search-admin"><option>All</option>${["Received", "Preparing", "Ready", "Completed", "Cancelled"].map((x) => `<option>${x}</option>`)}</select><div class="card panel table-wrap"><table class="data"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Type</th><th>Total</th><th>Payment</th><th>Status</th><th></th></tr></thead><tbody id="rows"></tbody></table></div>`;
        function draw() {
          $("#rows").innerHTML = os
            .filter(
              (o) =>
                ($("#f").value === "All" || o.status === $("#f").value) &&
                (o.customer + o.number)
                  .toLowerCase()
                  .includes($("#q").value.toLowerCase()),
            )
            .map(
              (o) =>
                `<tr><td>${E(o.number)}</td><td>${E(o.customer)}</td><td>${new Date(o.created_at).toLocaleString()}</td><td>${E(o.type)}</td><td>${M(o.total)}</td><td>${E(o.payment)}</td><td>${E(o.status)}</td><td><button data-id="${o.id}">Details</button></td></tr>`,
            )
            .join("");
        }
        $("#q").oninput = draw;
        $("#f").onchange = draw;
        draw();
        v.querySelectorAll("[data-id]").forEach(
          (b) =>
            (b.onclick = async () => {
              let o = await A("/api/orders/" + b.dataset.id);
              detail(
                `<h2>${E(o.number)}</h2><p>${E(o.customer)} · ${E(o.type)} · ${E(o.status)}</p>${o.items.map((x) => `<p>${x.quantity} × ${E(x.name)} · ${M(x.price * x.quantity)}</p>`).join("")}<h3>Total ${M(o.total)}</h3>`,
              );
            }),
        );
      } else if (section === "Products") {
        [products, cats] = await Promise.all([
          A("/api/products"),
          A("/api/categories"),
        ]);
        v.innerHTML = `<button class="btn" id="new">＋ Add product</button><div class="card panel table-wrap"><table class="data"><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Available</th><th>Actions</th></tr>${products.map((p) => `<tr><td>${E(p.name)}</td><td>${E(p.category)}</td><td>${M(p.price)}</td><td>${p.stock}</td><td>${p.available ? "Yes" : "No"}</td><td><button data-edit="${p.id}">Edit</button> <button data-del="${p.id}">Delete</button></td></tr>`).join("")}</table></div>`;
        $("#new").onclick = () => productForm();
        v.querySelectorAll("[data-edit]").forEach(
          (b) =>
            (b.onclick = () =>
              productForm(products.find((x) => x.id == b.dataset.edit))),
        );
        v.querySelectorAll("[data-del]").forEach(
          (b) =>
            (b.onclick = async () => {
              if (confirm("Delete this product?"))
                try {
                  await A("/api/products/" + b.dataset.del, {
                    method: "DELETE",
                  });
                  render();
                } catch (e) {
                  T(e.message);
                }
            }),
        );
      } else if (section === "Categories") {
        cats = await A("/api/categories");
        v.innerHTML = `<form id="cf" class="card panel"><input name="name" placeholder="Category name" required><button class="btn">Add</button></form><div class="card panel">${cats.map((c) => `<div class="item-row"><input data-name="${c.id}" value="${E(c.name)}"><input data-sort="${c.id}" type="number" value="${c.sort_order}" style="width:70px"><button data-save="${c.id}">Save</button><button data-delcat="${c.id}">Delete</button></div>`).join("")}</div>`;
        $("#cf").onsubmit = async (e) => {
          e.preventDefault();
          try {
            await A("/api/categories", {
              method: "POST",
              body: JSON.stringify({
                name: new FormData(e.target).get("name"),
              }),
            });
            render();
          } catch (x) {
            T(x.message);
          }
        };
        v.querySelectorAll("[data-save]").forEach(
          (b) =>
            (b.onclick = async () => {
              let i = b.dataset.save;
              await A("/api/categories/" + i, {
                method: "PUT",
                body: JSON.stringify({
                  name: v.querySelector(`[data-name="${i}"]`).value,
                  sort_order: v.querySelector(`[data-sort="${i}"]`).value,
                }),
              });
              T("Saved");
            }),
        );
        v.querySelectorAll("[data-delcat]").forEach(
          (b) =>
            (b.onclick = async () => {
              if (confirm("Delete category?"))
                try {
                  await A("/api/categories/" + b.dataset.delcat, {
                    method: "DELETE",
                  });
                  render();
                } catch (x) {
                  T(x.message);
                }
            }),
        );
      } else if (section === "Inventory") {
        let [rows, logs, settings] = await Promise.all([
            A("/api/inventory"),
            A("/api/inventory/logs"),
            A("/api/settings"),
          ]),
          threshold = Number(settings.lowStock) || 8;
        v.innerHTML = `<div class="card panel table-wrap"><table class="data"><tr><th>Product</th><th>Stock</th><th>Level</th><th>Adjust stock</th></tr>${rows.map((p) => `<tr><td>${E(p.name)}</td><td>${p.stock}</td><td>${p.stock <= threshold ? "⚠ Low" : "Good"}</td><td><input id="d${p.id}" type="number" value="1" style="width:65px"><button data-stock="${p.id}">Apply</button></td></tr>`).join("")}</table></div><section class="card panel" style="margin-top:16px"><h3>Recent inventory history</h3><div class="table-wrap"><table class="data"><tr><th>When</th><th>Product</th><th>Change</th><th>Reason</th></tr>${logs.map((x) => `<tr><td>${new Date(x.created_at).toLocaleString()}</td><td>${E(x.name || "Removed product")}</td><td>${x.delta > 0 ? "+" : ""}${x.delta}</td><td>${E(x.reason)}</td></tr>`).join("") || '<tr><td colspan="4">No adjustments recorded yet.</td></tr>'}</table></div></section>`;
        v.querySelectorAll("[data-stock]").forEach(
          (b) =>
            (b.onclick = async () => {
              try {
                await A("/api/inventory/" + b.dataset.stock, {
                  method: "PATCH",
                  body: JSON.stringify({
                    delta: +$("#d" + b.dataset.stock).value,
                    reason: "Admin adjustment",
                  }),
                });
                T("Stock adjusted");
                render();
              } catch (e) {
                T(e.message);
              }
            }),
        );
      } else if (section === "Analytics") {
        charts.forEach((c) => c.destroy());
        charts = [];
        let a = await A("/api/analytics?range=" + range);
        v.innerHTML = `<div class="tabs">${[
          ["1", "Today"],
          ["7", "7 days"],
          ["30", "30 days"],
          ["all", "All time"],
        ]
          .map(
            (x) =>
              `<button data-r="${x[0]}" class="${range === x[0] ? "active" : ""}">${x[1]}</button>`,
          )
          .join(
            "",
          )}</div><div class="admin-grid"><section class="card panel"><h3>Revenue and orders</h3><div class="chart-box"><canvas id="rev"></canvas></div></section><section class="card panel"><h3>Best sellers</h3><div class="chart-box"><canvas id="best"></canvas></div></section><section class="card panel"><h3>Payments</h3><div class="chart-box"><canvas id="pay"></canvas></div></section><section class="card panel"><h3>Category performance</h3><div class="chart-box"><canvas id="cats"></canvas></div></section></div>`;
        v.querySelectorAll("[data-r]").forEach(
          (b) =>
            (b.onclick = () => {
              range = b.dataset.r;
              render();
            }),
        );
        const drawCharts = () => {
          let reduced = window.matchMedia(
              "(prefers-reduced-motion: reduce)",
            ).matches,
            opt = {
              responsive: true,
              maintainAspectRatio: false,
              animation: reduced
                ? false
                : { duration: 780, easing: "easeOutQuart" },
            };
          charts.push(
            new Chart($("#rev"), {
              type: "line",
              data: {
                labels: a.daily.map((x) => x.day),
                datasets: [
                  {
                    label: "Revenue ₺",
                    data: a.daily.map((x) => x.revenue),
                    borderColor: "#8a6046",
                    tension: 0.3,
                  },
                  {
                    label: "Orders",
                    data: a.daily.map((x) => x.orders),
                    borderColor: "#4d8b68",
                    yAxisID: "y1",
                  },
                ],
              },
              options: {
                ...opt,
                scales: {
                  y: { beginAtZero: true },
                  y1: { position: "right", beginAtZero: true },
                },
              },
            }),
          );
          charts.push(
            new Chart($("#best"), {
              type: "bar",
              data: {
                labels: a.products.slice(0, 6).map((x) => x.name),
                datasets: [
                  {
                    label: "Sold",
                    data: a.products.slice(0, 6).map((x) => x.quantity),
                    backgroundColor: "#8a6046",
                  },
                ],
              },
              options: opt,
            }),
          );
          charts.push(
            new Chart($("#pay"), {
              type: "doughnut",
              data: {
                labels: a.payments.map((x) => x.payment),
                datasets: [
                  {
                    data: a.payments.map((x) => x.count),
                    backgroundColor: ["#8a6046", "#d69a45", "#4d8b68"],
                  },
                ],
              },
              options: opt,
            }),
          );
          charts.push(
            new Chart($("#cats"), {
              type: "bar",
              data: {
                labels: a.categories.map((x) => x.name),
                datasets: [
                  {
                    label: "Revenue ₺",
                    data: a.categories.map((x) => x.revenue),
                    backgroundColor: "#4d8b68",
                  },
                ],
              },
              options: opt,
            }),
          );
        };
        if (window.Chart) drawCharts();
        else {
          let script = document.createElement("script");
          script.src = "/vendor/chart.umd.js";
          script.onload = drawCharts;
          document.head.append(script);
        }
      } else if (section === "Settings") {
        let s = await A("/api/settings");
        v.innerHTML = `<form id="sf" class="card panel" style="max-width:700px">${[
          ["cafeName", "Cafe name"],
          ["currency", "Currency"],
          ["taxPercent", "Tax percent"],
          ["prepTime", "Prep minutes"],
          ["lowStock", "Low stock threshold"],
          ["contact", "Contact"],
        ]
          .map(
            ([n, l]) =>
              `<label class="field">${l}<input name="${n}" value="${E(s[n])}"></label>`,
          )
          .join(
            "",
          )}<label><input type="checkbox" name="acceptOrders" ${s.acceptOrders === "true" ? "checked" : ""}> Accept online orders</label><p><button class="btn">Save settings</button></p></form>`;
        $("#sf").onsubmit = async (e) => {
          e.preventDefault();
          let f = new FormData(e.target),
            d = Object.fromEntries(f);
          d.acceptOrders = f.has("acceptOrders");
          await A("/api/settings", { method: "PUT", body: JSON.stringify(d) });
          T("Settings saved");
        };
      }
    } catch (e) {
      T(e.message);
    }
  }
  function productForm(p = {}) {
    let d = detail(
      `<h2>${p.id ? "Edit" : "Add"} product</h2><form id="pf"><label class="field">Name<input name="name" required value="${E(p.name || "")}"></label><label class="field">Description<textarea name="description">${E(p.description || "")}</textarea></label><label class="field">Price<input name="price" type="number" min="0" step=".01" value="${p.price || ""}" required></label><label class="field">Category<select name="category_id">${cats.map((c) => `<option value="${c.id}" ${p.category_id === c.id ? "selected" : ""}>${E(c.name)}</option>`).join("")}</select></label><label class="field">Stock<input name="stock" type="number" value="${p.stock ?? 100}"></label><label class="field">Image (optional)<input name="image" type="file" accept="image/*"></label><label><input type="checkbox" name="available" ${p.available === false ? "" : "checked"}> Available</label> <label><input type="checkbox" name="track_stock" ${p.track_stock ? "checked" : ""}> Track inventory</label><label class="field">Options JSON<textarea name="options" rows="5">${E(
        JSON.stringify(
          p.options || {
            size: [
              { name: "Medium", price: 0 },
              { name: "Large", price: 25 },
            ],
            milk: [
              { name: "Regular", price: 0 },
              { name: "Oat", price: 20 },
            ],
            extras: [{ name: "Extra shot", price: 30 }],
          },
          null,
          2,
        ),
      )}</textarea></label><button class="btn">Save product</button></form>`,
    );
    $("#pf").onsubmit = async (e) => {
      e.preventDefault();
      let f = new FormData(e.target);
      f.set("available", e.target.available.checked);
      f.set("track_stock", e.target.track_stock.checked);
      try {
        await A("/api/products" + (p.id ? "/" + p.id : ""), {
          method: p.id ? "PUT" : "POST",
          body: f,
        });
        document.querySelector(".modal-back")?.remove();
        render();
        T("Product saved");
      } catch (x) {
        T(x.message);
      }
    };
  }
  S?.on(
    "connect",
    () =>
      ["Orders", "Overview", "Products", "Inventory"].includes(section) &&
      render(),
  );
  S?.on(
    "order-status-changed",
    () => ["Orders", "Overview"].includes(section) && render(),
  );
  S?.on("product-updated", () => section === "Products" && render());
  S?.on("inventory-updated", () => section === "Inventory" && render());
  layout();
}