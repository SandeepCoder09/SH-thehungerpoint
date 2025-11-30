/* ---- THEME ---- */
const themeBtn = document.getElementById("themeToggle");

if (themeBtn) {
  themeBtn.onclick = () => {
    const page = document.documentElement;

    if (page.getAttribute("data-theme") === "dark") {
      page.setAttribute("data-theme", "light");
      themeBtn.textContent = "🌙";
    } else {
      page.setAttribute("data-theme", "dark");
      themeBtn.textContent = "☀️";
    }
  };
}

/* ---- QR GENERATOR WITH LOGO ---- */
const generateBtn = document.getElementById("generateBtn");

if (generateBtn) {
  generateBtn.onclick = () => {
    const text = document.getElementById("qrText").value;
    const logoFile = document.getElementById("logoInput").files[0];

    const output = document.getElementById("qrOutput");
    const downloadBtn = document.getElementById("downloadBtn");
    const spinner = document.getElementById("loadingSpinner");

    if (!text) return alert("Enter something to generate QR");

    output.innerHTML = "";
    spinner.style.display = "block";

    // Step 1: Generate QR Base
    QRCode.toCanvas(text, { width: 300 }, async (err, canvas) => {
      spinner.style.display = "none";
      if (err) return alert("Error generating QR");

      const ctx = canvas.getContext("2d");

      // Step 2: If logo uploaded, draw it
      if (logoFile) {
        const logo = new Image();
        const reader = new FileReader();

        reader.onload = () => {
          logo.onload = () => {
            const size = canvas.width * 0.25; 
            const x = (canvas.width - size) / 2;
            const y = (canvas.height - size) / 2;

            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.roundRect(x, y, size, size, 12);
            ctx.fill();

            ctx.drawImage(logo, x, y, size, size);

            output.innerHTML = "";
            output.appendChild(canvas);

            downloadBtn.href = canvas.toDataURL();
          };
          logo.src = reader.result;
        };

        reader.readAsDataURL(logoFile);
      } else {
        output.innerHTML = "";
        output.appendChild(canvas);

        downloadBtn.href = canvas.toDataURL();
      }
    });
  };
}

/* ---- QR DECODER ---- */
const qrImage = document.getElementById("qrImage");

if (qrImage) {
  qrImage.onchange = function () {
    const file = this.files[0];
    if (!file) return;

    const spinner = document.getElementById("decodeSpinner");
    const textEl = document.getElementById("decodedText");
    const copyBtn = document.getElementById("copyBtn");

    spinner.style.display = "block";
    textEl.textContent = "Decoding...";

    const img = new Image();
    const reader = new FileReader();
    const canvas = document.getElementById("decodeCanvas");
    const ctx = canvas.getContext("2d");

    reader.onload = () => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const code = jsQR(imageData.data, canvas.width, canvas.height);

        spinner.style.display = "none";

        if (code) {
          textEl.textContent = `Decoded: ${code.data}`;
          copyBtn.style.display = "block";

          copyBtn.onclick = () => {
            navigator.clipboard.writeText(code.data);
            copyBtn.textContent = "Copied!";
            setTimeout(() => copyBtn.textContent = "Copy Text", 1500);
          };

        } else {
          textEl.textContent = "No QR code found";
          copyBtn.style.display = "none";
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };
}