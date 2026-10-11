const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
const IC = {
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    zip: '<path d="M5 3h10l4 4v14H5z"/><path d="M11 3v2m0 2v2m0 2v2"/><path d="M9.5 14h3v4h-3z"/>',
    grid: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    files: '<path d="M8 3h7l4 4v11H8zM5 7v14h11"/>',
    code: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="m21 16-5-5-9 9"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    download: '<path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    chl: '<path d="m15 5-7 7 7 7"/>',
    chr: '<path d="m9 5 7 7-7 7"/>',
    sqs: '<rect x="8" y="8" width="8" height="8" rx="2"/>',
    sqb: '<rect x="3" y="3" width="18" height="18" rx="4"/>',
};
const ic = (n, s = 20, w = 1.8) =>
    `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${IC[n]}</svg>`;
$$("[data-ic]").forEach((e) => (e.innerHTML = ic(e.dataset.ic, +e.dataset.s || 20, +e.dataset.w || 1.8)));
const MIME = {
    svg: "image/svg+xml",
    heic: "image/heic",
    heif: "image/heif",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    bmp: "image/bmp",
    ico: "image/x-icon",
};
const TEXT = new Set(
    "txt md markdown json js mjs cjs ts tsx jsx css scss less html htm xml yml yaml toml ini cfg conf csv tsv py java c h cpp hpp cs go rs php rb sh bat ps1 sql log env gitignore vue svelte kt swift lua r dart tex srt".split(
        " ",
    ),
);
let files = [],
    cur = "",
    sub = true,
    q = "",
    type = "all",
    view = "grid",
    list = [],
    idx = 0,
    src = "folder",
    showSrc = false;
// Bin + undo/redo state
const BIN = "#bin"; // value of `cur` while the Bin is open
let bin = [], binId = 0, binSel = new Set(), binList = [], prevCur = "", hist = [], redoSt = [];
const IMGX = new Set(Object.keys(MIME));
Object.assign(MIME, {
    ttf: "font/ttf",
    otf: "font/otf",
    woff: "font/woff",
    woff2: "font/woff2",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    oga: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
    aac: "audio/aac",
    opus: "audio/ogg",
    weba: "audio/webm",
    mp4: "video/mp4",
    webm: "video/webm",
    ogv: "video/ogg",
    mov: "video/quicktime",
    m4v: "video/mp4",
    pdf: "application/pdf",
});
const FONT = new Set("ttf otf woff woff2".split(" ")),
    AUD = new Set("mp3 wav ogg oga m4a flac aac opus weba".split(" ")),
    VID = new Set("mp4 webm ogv mov m4v".split(" "));
const isImg = (f) => IMGX.has(f.ext),
    isTxt = (f) => TEXT.has(f.ext);
const kind = (f) =>
    isImg(f)
        ? "img"
        : isTxt(f)
          ? "txt"
          : FONT.has(f.ext)
            ? "font"
            : AUD.has(f.ext)
              ? "aud"
              : VID.has(f.ext)
                ? "vid"
                : f.ext === "pdf"
                  ? "pdf"
                  : "oth";
const looksText = (u) => !u.includes(0) && u.filter((c) => c < 9 || (c > 13 && c < 32)).length <= u.length * 0.02;
const hex = (u) => {
    let o = "";
    for (let i = 0; i < u.length; i += 16) {
        const r = [...u.slice(i, i + 16)];
        o +=
            i.toString(16).padStart(6, "0") +
            "  " +
            r
                .map((c) => c.toString(16).padStart(2, "0"))
                .join(" ")
                .padEnd(47) +
            "  " +
            r.map((c) => (c > 31 && c < 127 ? String.fromCharCode(c) : ".")).join("") +
            "\n";
    }
    return o;
};
const peek = async (f, n) => {
    const u = new Uint8Array(await (await f.get()).slice(0, n).arrayBuffer());
    return looksText(u) ? new TextDecoder().decode(u) : hex(u);
};
let fc = 0;
const loadFont = (f) =>
    f.ff ||
    (f.ff = (async () => {
        try {
            const b = await f.get(),
                ff = new FontFace("pk" + ++fc, await b.arrayBuffer());
            await ff.load();
            document.fonts.add(ff);
            return ff.family;
        } catch (e) {
            return null;
        }
    })());
function flip(change) {
    const c = $("#content"),
        cr = c.getBoundingClientRect();
    const els = [...c.querySelectorAll(".card,.row")].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > cr.top - 300 && r.top < cr.bottom + 300;
    });
    const first = els.map((el) => el.getBoundingClientRect());
    change();
    els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()));
    els.forEach((el, i) => {
        const a = first[i],
            b = el.getBoundingClientRect();
        const dx = a.left - b.left,
            dy = a.top - b.top,
            sx = a.width / b.width,
            sy = a.height / b.height;
        if (Math.abs(dx) + Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) return;
        el.animate(
            [
                { transformOrigin: "0 0", transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})` },
                { transformOrigin: "0 0", transform: "none" },
            ],
            { duration: 520, easing: "cubic-bezier(.22,1,.36,1)" },
        );
    });
}

const url = (f) =>
    f.p ||
    (f.p = Promise.resolve(f.get()).then((b) => URL.createObjectURL(new Blob([b], { type: MIME[f.ext] || "" }))));
const HEIC = new Set(["heic", "heif"]);
let heicLib,
    heicQ = Promise.resolve();
const loadHeic = () =>
    (heicLib ||= new Promise((ok, no) => {
        if (window.heic2any) return ok(window.heic2any);
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js";
        s.onload = () => ok(window.heic2any);
        s.onerror = () => {
            heicLib = null;
            no(new Error("Could not load the HEIC decoder"));
        };
        document.head.append(s);
    }));
async function heicToJpeg(f) {
    try {
        const convert = await loadHeic();
        let b = await convert({ blob: new Blob([await f.get()], { type: "image/heic" }), toType: "image/jpeg", quality: 0.9 });
        if (Array.isArray(b)) b = b[0];
        return URL.createObjectURL(b);
    } catch (err) {
        f.hv = null;
        toast("Couldn’t decode " + f.name);
        return url(f);
    }
}
// What the <img> should display: HEIC files are converted to JPEG first, everything else uses url()
const show = (f, now) => {
    if (!HEIC.has(f.ext)) return url(f);
    if (f.hv) return f.hv;
    if (now) return (f.hv = heicToJpeg(f)); // preview: convert immediately
    const job = heicQ.then(() => heicToJpeg(f)); // thumbnails: one at a time
    heicQ = job.catch(() => {});
    return (f.hv = job);
};
const fmt = (n) =>
    n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB";
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const body = document.body;

// background swatches (solid colours)
$$(".sw").forEach(
    (w) =>
        (w.innerHTML = ["#d2d4d5", "#11324a", "#0d0e05", "#a15c88"]
            .map((c, i) => `<b data-c="${c}" style="background:${c}" class="${i ? "" : "on"}"></b>`)
            .join("")),
);
$$(".sw b").forEach(
    (b) =>
        (b.onclick = () => {
            document.documentElement.style.setProperty("--thumb", b.dataset.c);
            $$(".sw b").forEach((x) => x.classList.toggle("on", x.dataset.c === b.dataset.c));
        }),
);

function render(rebuild = true) {
    if (rebuild) tree();
    else $$(".dir").forEach((el) => el.classList.toggle("on", el.dataset.d === cur));
    const s = q.toLowerCase();
    list = files
        .filter(
            (f) =>
                (sub ? !cur || f.dir === cur || f.dir.startsWith(cur + "/") : f.dir === cur) &&
                (type === "all" || (type === "svg" ? f.ext === "svg" : isImg(f))) &&
                (!s || f.path.toLowerCase().includes(s)),
        )
        .sort((a, b) => a.path.localeCompare(b.path, 0, { numeric: true }));
    $("#crumb").textContent = cur || "All files";
    $("#count").textContent = `${list.length} files · ${list.filter((f) => f.ext === "svg").length} svg`;
    const c = $("#content");
    if (!list.length) {
        c.innerHTML = '<div class="empty">No matching files</div>';
        return;
    }
    c.scrollTop = 0;
    const th = (f, i) => {
        const k = kind(f);
        if (k === "img") return `<div class="th"><img class="lz" data-k="img" alt="" data-i="${i}"></div>`;
        if (k === "vid")
            return `<div class="th"><video class="lz" data-k="vid" data-i="${i}" muted playsinline preload="metadata"></video></div>`;
        if (k === "font") return `<div class="th f"><span class="fa lz" data-k="font" data-i="${i}">Aa</span></div>`;
        if (view === "grid" && (k === "txt" || k === "oth"))
            return `<div class="th t"><pre class="snip lz" data-k="${k}" data-i="${i}"></pre></div>`;
        return `<div class="th e"><span class="ext">${esc((f.ext || "file").slice(0, 5).toUpperCase())}</span></div>`;
    };
    const an = (i) => (i < 48 ? `a" style="--d:${i * 22}ms` : "");
    c.innerHTML =
        view === "grid"
            ? `<div class="grid">${list.map((f, i) => `<div class="card ${an(i)}" data-i="${i}" title="${esc(f.path)}">${th(f, i)}<div class="nm">${esc(f.name)}<small>${fmt(f.size)}</small></div></div>`).join("")}</div>`
            : `<div class="list">${list.map((f, i) => `<div class="row ${an(i)}" data-i="${i}">${th(f, i)}<span class="n">${esc(f.name)}</span><span class="p">${esc(f.dir)}</span><span class="s">${fmt(f.size)}</span></div>`).join("")}</div>`;
    lazy();
}
let io;
function lazy() {
    io && io.disconnect();
    io = new IntersectionObserver(
        (es) =>
            es.forEach(async (e) => {
                if (!e.isIntersecting) return;
                const t = e.target;
                io.unobserve(t);
                const f = list[t.dataset.i];
                if (!f) return;
                const k = t.dataset.k;
                if (k === "img") {
                    t.onload = t.onerror = () => {
                        t.classList.add("ld");
                        f.ld = 1;
                    };
                    if (f.ld) t.style.transition = "none"; // already seen once: don't fade in again after a re-render
                    t.src = await show(f);
                } else if (k === "vid") {
                    t.onloadeddata = t.onerror = () => t.classList.add("ld");
                    t.src = (await url(f)) + "#t=0.1";
                } else if (k === "font") {
                    const m = await loadFont(f);
                    if (m) t.style.fontFamily = m + ",sans-serif";
                    else t.textContent = f.ext.toUpperCase();
                } else t.textContent = await peek(f, k === "txt" ? 420 : 192);
            }),
        { root: $("#content"), rootMargin: "600px" },
    );
    $$("#content .lz").forEach((i) => io.observe(i));
}
$("#content").addEventListener("click", (e) => {
    const t = e.target.closest("[data-i]");
    if (t) open(+t.dataset.i);
});

async function open(i) {
    idx = (i + list.length) % list.length;
    const f = list[idx],
        k = kind(f);
    $("#modal").classList.add("on");
    $("#mt").innerHTML = `${esc(f.name)}<small>${esc(f.path)} · ${fmt(f.size)}</small>`;
    const img = $("#mi"),
        pre = $("#mp"),
        mv = $("#mv"),
        sb = $("#src"),
        ok = () => list[idx] === f;
    mv.querySelectorAll("audio,video").forEach((m) => m.pause());
    mv.innerHTML = "";
    sb.hidden = f.ext !== "svg";
    sb.classList.toggle("on", showSrc);
    const txt = k === "txt" || (f.ext === "svg" && showSrc);
    $("#stage").classList.toggle("txt", txt || k !== "img");
    img.style.display = "none";
    img.classList.remove("in");
    pre.hidden = mv.hidden = true;
    url(f).then((u) => {
        if (ok()) {
            $("#dl").href = u;
            $("#dl").download = f.name;
        }
    });
    if (txt) {
        pre.hidden = false;
        pre.textContent = "Loading…";
        const b = await f.get(),
            t = await b.slice(0, 300000).text();
        if (!ok()) return;
        pre.textContent = t + (b.size > 300000 ? "\n\n… file truncated for preview" : "");
        pre.scrollTop = 0;
    } else if (k === "img") {
        img.style.display = "";
        img.removeAttribute("src");
        const u = await show(f, true);
        if (!ok()) return;
        img.onload = () => {
            img.classList.add("in");
            const s = $("#mt small");
            if (ok() && s && img.naturalWidth) s.textContent += ` · ${img.naturalWidth}×${img.naturalHeight}`;
        };
        img.src = u;
    } else if (k === "font") {
        const m = await loadFont(f);
        if (!ok()) return;
        mv.hidden = false;
        mv.innerHTML = m
            ? `<div class="spec" style="font-family:${m},sans-serif"><div class="big">Aa Gg Qq</div><p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p><p>abcdefghijklmnopqrstuvwxyz</p><p>0123456789 !?@#$%&amp;*()</p><p class="s" contenteditable spellcheck="false">The quick brown fox jumps over the lazy dog</p><small>Click the sentence to type your own text</small></div>`
            : '<p class="msg">This font could not be read by the browser.</p>';
    } else if (k === "vid" || k === "aud" || k === "pdf") {
        const u = await url(f);
        if (!ok()) return;
        mv.hidden = false;
        const tg = k === "vid" ? "video" : "audio";
        mv.innerHTML =
            k === "pdf"
                ? `<iframe src="${u}" title="${esc(f.name)}"></iframe>`
                : `<${tg} src="${u}" controls playsinline></${tg}>`;
    } else {
        pre.hidden = false;
        pre.textContent = "Loading…";
        const t = await peek(f, 6144);
        if (!ok()) return;
        pre.textContent = t + (f.size > 6144 ? "\n… showing the first 6 KB" : "");
    }
}
const close = () => {
    $("#modal").classList.remove("on");
    $$("#mv audio,#mv video").forEach((m) => m.pause());
};
$("#mx").onclick = close;
$("#pv").onclick = () => open(idx - 1);
$("#nx").onclick = () => open(idx + 1);
$("#src").onclick = () => {
    showSrc = !showSrc;
    open(idx);
};
$("#modal").onclick = (e) => {
    if (e.target.id === "modal") close();
};
addEventListener("keydown", (e) => {
    if (!$("#modal").classList.contains("on")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") open(idx - 1);
    if (e.key === "ArrowRight") open(idx + 1);
});

let tm;
$("#q").oninput = (e) => {
    clearTimeout(tm);
    tm = setTimeout(() => {
        q = e.target.value;
        render(false);
    }, 150);
};
const sz = $("#sz"),
    setSz = () => {
        sz.style.setProperty("--p", ((sz.value - sz.min) / (sz.max - sz.min)) * 100 + "%");
        $("#content").style.setProperty("--sz", sz.value + "px");
        $("#szv").textContent = sz.value + "px";
    };
sz.oninput = () => flip(setSz);
setSz();
const seg = (sel, key, set) =>
    $$(sel + " button").forEach(
        (b) =>
            (b.onclick = () => {
                set(b.dataset[key]);
                $$(sel + " button").forEach((x) => x.classList.toggle("on", x === b));
                render(false);
            }),
    );
seg("#types", "t", (v) => (type = v));
seg("#views", "v", (v) => (view = v));

/* ---------- Lumen v5 ---------- */
Object.assign(IC, {
    pc: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    mc: '<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    vol: '<path d="M4 9v6h4l5 4V5L8 9zM17 9a4 4 0 0 1 0 6"/>',
    mute: '<path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6m0-6-5 6"/>',
    full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    pen: '<path d="m4 20 1-4L16 5l3 3L8 19zM14 7l3 3"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    go: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    cut: '<path d="M4 20h16M7 16l-3-3 8-9 7 7-6 6z"/>',
    seek: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
    newf: IC.folder + '<path d="M12 10v6M9 13h6"/>',
    newfile: '<path d="M6 3h8l5 5v13H6zM12 11v6M9 14h6"/>',
    save: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
    flag: '<path d="M5 21V4m0 0h11l-2 4 2 4H5"/>',
    master:
        '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="m12 10.3 1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    bin: '<path d="M4 7h16M9 7l.7-3h4.6L15 7M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
    restore: '<path d="M4 12a8 8 0 1 0 2.6-5.9L4 8.5"/><path d="M4 4v4.5h4.5M12 8v4l2.5 2"/>',
});
$$("[data-ic]").forEach((e) => (e.innerHTML = ic(e.dataset.ic, +e.dataset.s || 20, +e.dataset.w || 1.8)));
TEXT.add("rtf");
body.insertAdjacentHTML(
    "beforeend",
    '<div id="ld"><div class="bx"><div class="spn"></div><b id="ldn"></b><div class="pb"><i id="ldb"></i></div><small id="ldp"></small></div></div><div id="cm"></div>',
);
$("#stage").insertAdjacentHTML("beforeend", '<textarea id="ed" hidden spellcheck="false"></textarea>');
$("#dl").insertAdjacentHTML("beforebegin", '<button class="ib" id="sv" hidden data-tip="Save"></button>');
$("#sv").innerHTML = ic("save");
let dirs = new Set(),
    title = "",
    dragI = null,
    edf = null,
    dirty = 0,
    P = { n: 0, t: 1 },
    tt,
    hl,
    svt;
let multi = false; // true when the workspace holds more than one top-level folder
const DB = new Promise((r) => {
    try {
        const o = indexedDB.open("peek", 1);
        o.onupgradeneeded = () => o.result.createObjectStore("k");
        o.onsuccess = () => r(o.result);
        o.onerror = () => r(null);
    } catch (e) {
        r(null);
    }
});
const idb = async (m, k, v) => {
    const d = await DB;
    if (!d) return;
    return new Promise((r) => {
        try {
            const s = d.transaction("k", m === "get" ? "readonly" : "readwrite").objectStore("k"),
                q = m === "get" ? s.get(k) : m === "put" ? s.put(v, k) : s.delete(k);
            q.onsuccess = () => r(q.result);
            q.onerror = () => r();
        } catch (e) {
            r();
        }
    });
};
const save = () => {
    clearTimeout(svt);
    svt = setTimeout(
        () => idb("put", "s", { name: title, multi, dirs: [...dirs], files: files.map((f) => ({ path: f.path, b: f.blob })), bin: serBin() }),
        400,
    );
};
const toast = (t) => {
    const b = $("#busy");
    b.textContent = t;
    b.style.display = "block";
    clearTimeout(tt);
    tt = setTimeout(() => (b.style.display = "none"), 2200);
};
const setP = (p, s) => {
    p = Math.min(100, Math.round(p));
    $("#ldb").style.width = p + "%";
    $("#ldp").textContent = p + "%" + (s ? " · " + s : "");
};
const showLd = (n, s) => {
    clearTimeout(hl);
    $("#ld").classList.add("on");
    $("#ldn").textContent = n;
    setP(0, s);
};
const hideLd = () => {
    setP(100);
    hl = setTimeout(() => $("#ld").classList.remove("on"), 350);
};
const tick = async () => {
    P.n++;
    setP((P.n / P.t) * 100, P.n + " of " + P.t + " files");
    if (P.n % 25 === 0) await new Promise(requestAnimationFrame);
};
const uniq = (p) => {
    let q = p,
        k = 0;
    const d = p.lastIndexOf("."),
        i = d > p.lastIndexOf("/") + 1 ? d : p.length;
    while (files.some((f) => f.path === q)) q = p.slice(0, i) + " (" + ++k + ")" + p.slice(i);
    return q;
};
function add(path, blob, u) {
    if (u) path = uniq(path);
    const i = path.lastIndexOf("/"),
        name = path.slice(i + 1);
    if (!name || /(^|\/)(__MACOSX|\.git)\//.test(path) || name.startsWith(".")) return;
    files.push({
        path,
        name,
        dir: i < 0 ? "" : path.slice(0, i),
        ext: name.includes(".") ? name.split(".").pop().toLowerCase() : "",
        size: blob.size,
        blob,
        get() {
            return this.blob;
        },
        p: null,
    });
}
function setPath(f, p) {
    f.path = p;
    const i = p.lastIndexOf("/");
    f.name = p.slice(i + 1);
    f.dir = i < 0 ? "" : p.slice(0, i);
    f.ext = f.name.includes(".") ? f.name.split(".").pop().toLowerCase() : "";
    f.p = null;
}
async function unzip(b, pre) {
    const z = await JSZip.loadAsync(b),
        es = [];
    z.forEach((p, e) => {
        if (!e.dir) es.push([p, e]);
    });
    P.t += es.length - 1;
    for (const [p, e] of es) {
        add(pre + p, await e.async("blob"));
        await tick();
    }
}
async function ingest(out, ttl, o = {}) {
    showLd(ttl, "Reading…");
    P = { n: 0, t: out.length };
    const before = o.merge ? new Set(files) : null;
    try {
        if (!o.merge) {
            files = [];
            dirs = new Set();
            cur = "";
            title = ttl;
            bin = [];
            binSel.clear();
            hist.length = redoSt.length = 0;
            updBin();
            updHist();
        }
        for (const [p, b, z] of out) {
            if (z !== undefined) await unzip(b, z); // z = folder to extract this zip into
            else {
                add(p, b, o.merge);
                await tick();
            }
        }
    } catch (e) {
        await dlg({ t: "Couldn’t read that", m: e.message, b: [["OK", true, "pri"]] });
    }
    body.classList.remove("empty");
    body.classList.add("rv");
    $$(".ctl").forEach((e, i) => e.style.setProperty("--n", i));
    if (before) {
        files.forEach((f) => before.has(f) || fresh.set(f, "new"));
        smooth(() => render());
    } else render();
    save();
    hideLd();
}
const nameOf = (o) =>
    o[0][0].includes("/")
        ? o[0][0].split("/")[0]
        : o.length === 1
          ? o[0][0].replace(/\.zip$/i, "")
          : o.length + " files";
body.insertAdjacentHTML(
    "beforeend",
    '<div id="dg"><div class="bx"><h4 id="dgt"></h4><p id="dgm"></p><input id="dgi" hidden spellcheck="false"><div class="ac" id="dga"></div></div></div>',
);
function dlg(o) {
    return new Promise((r) => {
        const g = $("#dg"),
            i = $("#dgi"),
            a = $("#dga");
        $("#dgt").textContent = o.t || "";
        $("#dgm").textContent = o.m || "";
        $("#dgm").hidden = !o.m;
        i.hidden = o.v === undefined;
        i.value = o.v || "";
        a.innerHTML = "";
        const fin = (v) => {
            g.classList.remove("on");
            removeEventListener("keydown", kd, true);
            r(v);
        };
        const kd = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                fin(null);
            } else if (e.key === "Enter") {
                const p = a.querySelector(".pri");
                if (p) {
                    e.preventDefault();
                    p.click();
                }
            }
        };
        (
            o.b || [
                ["Cancel", null],
                ["OK", true, "pri"],
            ]
        ).forEach(([l, v, c]) => {
            const b = document.createElement("button");
            b.textContent = l;
            b.className = c || "";
            b.onclick = () => fin(v && !i.hidden ? i.value.trim() : v);
            a.append(b);
        });
        addEventListener("keydown", kd, true);
        g.classList.add("on");
        if (i.hidden) {
            (a.querySelector(".pri") || a.firstElementChild).focus();
        } else {
            i.focus();
            i.select();
        }
    });
}
const isZip = (n) => /\.zip$/i.test(n),
    base = () => (cur && cur !== "*" && cur !== BIN ? cur + "/" : "");
const topNames = () => new Set([...allDirs()].map((d) => d.split("/")[0]));
// A single-folder workspace becomes multi-folder: its content moves under a folder named after it
function reroot() {
    const r = title;
    files.forEach((f) => setPath(f, r + "/" + f.path));
    dirs = new Set([...dirs].map((d) => r + "/" + d));
    dirs.add(r);
    bin.forEach((b) => {
        b.path = r + "/" + b.path;
        if (b.kind === "dir") {
            b.items.forEach((x) => (x.path = r + "/" + x.path));
            b.dirs = b.dirs.map((d) => r + "/" + d);
        }
    });
    cur = "";
}
async function addLoose(list) {
    let k = 0;
    for (const [p, b] of list) {
        const q = await clash(base() + p, null); // asks Replace / Change name / Cancel on a clash
        if (q === null) continue;
        add(q, b);
        const nf = files[files.length - 1];
        if (nf && nf.path === q) fresh.set(nf, "new");
        k++;
    }
    if (k) done("Added " + k + (k === 1 ? " file" : " files"));
}
async function start(out) {
    if (!out.length) return;
    const isOpen = !body.classList.contains("empty");
    const top = out.filter(([p]) => !p.includes("/"));
    const zips = top.filter(([p]) => isZip(p));
    const loose = top.filter(([p]) => !isZip(p));
    const groups = new Map(); // top-level folder name -> its files
    out.forEach(([p, b]) => {
        if (!p.includes("/")) return;
        const r = p.split("/")[0];
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r).push([p, b]);
    });
    const n = groups.size + zips.length;
    if (!n) {
        if (isOpen) return addLoose(loose);
        return dlg({
            t: "Open a folder or a zip",
            m: "Single files can’t be opened on their own. Choose or drop a folder or a .zip archive.",
            b: [["OK", true, "pri"]],
        });
    }
    const single = !isOpen && n === 1 && !loose.length;
    if (isOpen && !multi) reroot();
    const used = isOpen ? topNames() : new Set();
    const uniqName = (nm) => {
        let q = nm,
            k = 1;
        while (used.has(q)) q = nm + " (" + ++k + ")";
        used.add(q);
        return q;
    };
    let items = [],
        ttl;
    for (const [r, list] of groups) {
        if (single) {
            items = list.map(([p, b]) => [p.slice(r.length + 1), b]);
            ttl = r;
        } else {
            const q = uniqName(r);
            list.forEach(([p, b]) => items.push([q + p.slice(r.length), b]));
        }
    }
    for (const [p, b] of zips) {
        const nm = p.replace(/\.zip$/i, "");
        if (single) {
            items = [[p, b, ""]];
            ttl = nm;
        } else items.push([p, b, uniqName(nm) + "/"]);
    }
    loose.forEach(([p, b]) => items.push([isOpen ? base() + p : p, b]));
    multi = !single;
    if (multi) ttl = title = used.size + (used.size === 1 ? " folder" : " folders");
    await ingest(items, ttl, { merge: isOpen });
}
const rf = (en) => new Promise((ok, no) => en.file(ok, no)),
    rd2 = (r) => new Promise((ok, no) => r.readEntries(ok, no));
async function gather(en, path, out) {
    if (en.isFile) out.push([path + en.name, await rf(en)]);
    else {
        const r = en.createReader();
        let a = [],
            b;
        do {
            b = await rd2(r);
            a.push(...b);
        } while (b.length);
        for (const c of a) await gather(c, path + en.name + "/", out);
    }
}
/* ---------- Drag & drop overlay: shown ONLY while real files are dragged in from outside ---------- */
let dragDepth = 0;
const hasFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files");
const overOff = () => {
    dragDepth = 0;
    body.classList.remove("over");
};
// only cards (and text fields) may start a drag: images, links and selected text can't be dragged around the page
addEventListener(
    "dragstart",
    (e) => {
        const el = e.target.nodeType === 1 ? e.target : e.target.parentElement;
        if (!el || !el.closest("[data-i],textarea,input,[contenteditable]")) e.preventDefault();
    },
    true,
);
document.addEventListener("dragenter", (e) => {
    e.preventDefault();
    if (!hasFiles(e)) return; // card drags, text, images, links from other tabs: no overlay
    if (dragI !== null) {
        dragI = null; // real files can never be an internal drag, so clear any stale state
        body.classList.remove("mvg");
    }
    dragDepth++;
    body.classList.add("over");
});
document.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (hasFiles(e) && dragI === null) body.classList.add("over");
});
document.addEventListener("dragleave", (e) => {
    if (hasFiles(e) && --dragDepth <= 0) overOff();
});
// fail-safe: the browser sends no pointer events during a drag, so any pointer activity means it's over
["pointermove", "pointerdown"].forEach((n) =>
    addEventListener(n, () => body.classList.contains("over") && overOff(), true),
);
document.addEventListener("drop", async (e) => {
    e.preventDefault();
    overOff();
    body.classList.remove("mvg");
    if (dragI !== null) {
        dragI = null;
        return;
    }
    const dt = e.dataTransfer,
        ens = [...dt.items]
            .map((i) => (i.kind === "file" && i.webkitGetAsEntry ? i.webkitGetAsEntry() : null))
            .filter(Boolean),
        fl = [...dt.files];
    if (!ens.length && !fl.length) return;
    showLd("Reading…", "Scanning");
    const out = [];
    try {
        if (ens.length) for (const en of ens) await gather(en, "", out);
        else fl.forEach((f) => out.push([f.webkitRelativePath || f.name, f]));
    } catch (err) {
        hideLd();
        return dlg({
            t: "Couldn’t read that",
            m: "The browser blocked access to the dropped item. Try “Choose a folder” instead.",
            b: [["OK", true, "pri"]],
        });
    }
    hideLd();
    start(out, true);
});
$("#fAny").onchange = (e) => {
    const fs = [...e.target.files];
    e.target.value = "";
    addLoose(fs.map((f) => [f.name, f]));
};
$("#fFolder").onchange = (e) => {
    const fs = [...e.target.files];
    e.target.value = "";
    start(fs.map((f) => [f.webkitRelativePath || f.name, f]));
};
$("#fZip").onchange = (e) => {
    const fs = [...e.target.files];
    e.target.value = "";
    start(fs.map((f) => [f.name, f]));
};

/* ---------- Lumen 3D depth heading (empty "no folder" screen) ----------
   Colours are read from your CSS variable --ac, so it follows the site theme. */
const DEPTH_HERO = {
    lines: ["Peek & organise", "any folder - By Lumen"],
    layers: 30,          // extrusion slices on desktop
    mobileLayers: 20,    // fewer slices on phones = smoother
    depthEm: 0.5,        // total extrusion depth, relative to the font size
    faceColor: "#ece6ea",
    fallbackDepth: "#a15c88",
    tilt: 7.5,           // max tilt in degrees
    smoothing: 0.14,
    perspective: 900,
    autoOrbit: true,
    orbitSpeed: 0.35,
    introMs: 1100,       // unfold animation length
    maxFont: 84          // px cap on big screens
};

function mountDepthHero(host) {
    const C = DEPTH_HERO;
    const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const canTrack = finePointer && !reduced;
    const layers = window.matchMedia("(max-width: 700px)").matches ? C.mobileLayers : C.layers;
    const depthColor =
        getComputedStyle(document.documentElement).getPropertyValue("--ac").trim() || C.fallbackDepth;
    const html = C.lines.join("<br>");

    host.textContent = "";
    host.classList.add("depth-hero");

    const stage = document.createElement("span");
    stage.className = "depth-hero__stage";

    // back-to-front stack of extrusion layers
    for (let i = layers; i >= 1; i--) {
        const l = document.createElement("span");
        l.className = "depth-hero__layer";
        l.setAttribute("aria-hidden", "true");
        l.innerHTML = html;
        l.style.setProperty("--i", i);
        const eased = Math.pow(i / layers, 2);
        const faceMix = Math.round((1 - eased) * 72 + 4);
        l.style.color = `color-mix(in srgb, ${C.faceColor} ${faceMix}%, ${depthColor})`;
        stage.appendChild(l);
    }

    // crisp front face (the real, readable text)
    const face = document.createElement("span");
    face.className = "depth-hero__face";
    face.innerHTML = html;
    face.style.color = C.faceColor;
    stage.appendChild(face);

    host.style.setProperty("--dh-perspective", C.perspective + "px");
    host.style.setProperty(
        "--dh-shadow",
        `0 18px 30px color-mix(in srgb, ${depthColor} 38%, transparent), 0 4px 8px rgba(0,0,0,.35)`
    );
    host.appendChild(stage);

    // size to fit the screen, then derive the per-layer step from the font size
    const fit = () => {
        const parent = host.parentElement;
        const avail = Math.max(120, (parent ? parent.clientWidth : window.innerWidth) - 28);
        let px = clamp(window.innerWidth * 0.095, 30, C.maxFont);
        stage.style.setProperty("--dh-fs", px + "px");
        const w = face.offsetWidth;
        if (w > avail) px = Math.floor(px * (avail / w));
        stage.style.setProperty("--dh-fs", px + "px");
        stage.style.setProperty("--step", ((px * C.depthEm) / layers).toFixed(3) + "px");
    };
    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    window.addEventListener("resize", fit);

    // tilt + orbit + unfold
    const base = { x: -C.tilt * 0.32, y: C.tilt * 0.42 };
    const cur = { ...base };
    const tgt = { ...base };
    let active = false;
    let raf = 0;
    const t0 = performance.now();
    const apply = () =>
        (stage.style.transform = `rotateX(${cur.x.toFixed(3)}deg) rotateY(${cur.y.toFixed(3)}deg)`);

    const onMove = (e) => {
        const r = host.getBoundingClientRect();
        if (!r.width || !r.height) return;
        active = true;
        const x = clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.8), -1, 1);
        const y = clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.8), -1, 1);
        tgt.x = base.x - y * C.tilt;
        tgt.y = base.y + x * C.tilt;
    };
    const onLeave = () => {
        active = false;
        tgt.x = base.x;
        tgt.y = base.y;
    };
    const cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", fit);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerleave", onLeave);
        window.removeEventListener("blur", onLeave);
    };

    if (reduced) {
        stage.style.setProperty("--grow", 1);
        apply();
        return cleanup;
    }

    if (canTrack) {
        window.addEventListener("pointermove", onMove, { passive: true });
        window.addEventListener("pointerleave", onLeave);
        window.addEventListener("blur", onLeave);
    }

    const tick = (now) => {
        if (!host.isConnected) return cleanup(); // screen was replaced (folder opened)
        const k = clamp((now - t0) / C.introMs, 0, 1);
        stage.style.setProperty("--grow", (1 - Math.pow(1 - k, 3)).toFixed(3));

        if ((!canTrack || !active) && C.autoOrbit) {
            const orbit = ((now - t0) / 1000) * C.orbitSpeed * Math.PI * 2;
            const amt = canTrack ? 0.18 : 0.55; // touch screens get a bigger idle sway
            tgt.x = base.x + Math.sin(orbit) * C.tilt * amt;
            tgt.y = base.y + Math.cos(orbit * 0.85) * C.tilt * amt;
        }
        cur.x += (tgt.x - cur.x) * C.smoothing;
        cur.y += (tgt.y - cur.y) * C.smoothing;
        apply();
        raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return cleanup;
}

/* keep a handle so a re-mount (Close folder) stops the old animation loop */
let stopDepthHero = null;

function mountDrop() {
    if (stopDepthHero) stopDepthHero();
    $("#content").innerHTML =
        `<div id="drop"><h1 class="hero" id="heroText">Look inside any folder</h1><div class="drop-rest"><p class="tag">Open a folder or a zip to browse, organise and edit it right here. Nothing leaves your device. We allow you to operate like <span>WINDOWS</span> doesn't.</p><div class="zone" id="zn"><div class="zi">${ic("folder", 64, 1.4)}</div><h3>Drop folders or zips</h3><p>or click to choose a folder</p><a class="lnk" id="zf">Choose a .zip instead</a></div></div></div>`;
    stopDepthHero = mountDepthHero($("#heroText"));
    const z = $("#zn");
    z.onclick = () => $("#fFolder").click();
    $("#zf").onclick = (e) => {
        e.stopPropagation();
        $("#fZip").click();
    };
    ["dragenter", "dragover"].forEach((n) => z.addEventListener(n, () => z.classList.add("hot")));
    ["dragleave", "drop"].forEach((n) => z.addEventListener(n, () => z.classList.remove("hot")));
}
/* ---------- Lumen animated logo (navbar + empty-state, one shared element) ---------- */
const LUMEN_NAME = "LUMEN";

function lumenLogoMarkup() {
    const folder = (id) => `
        <g id="${id}" class="lm-item">
            <path d="M-9 -6.5 C-9 -7.8 -7.8 -8.8 -6.5 -8.8 H-2 C-1 -8.8 0 -7.8 1 -6.8 L2.5 -5 H6 C7.5 -5 9 -4 9 -2.5 V6 C9 7.5 7.5 8.8 6 8.8 H-6 C-7.5 8.8 -9 7.5 -9 6 Z" fill="#11324a" stroke="#d2d4d5" stroke-opacity="0.45" stroke-width="0.8"/>
            <rect x="-6" y="-5.5" width="12" height="10" rx="1.2" fill="#ffffff" fill-opacity="0.85"/>
            <path d="M-9.5 -2.5 C-9.5 -4 -8 -5 -6.5 -5 H6.5 C8 -5 9.5 -4 9.5 -2.5 L8.5 6 C8.5 7.5 7 8.8 5.5 8.8 H-5.5 C-7 8.8 -8.5 7.5 -8.5 6 Z" fill="#a15c88" stroke="#ffffff" stroke-opacity="0.45" stroke-width="0.75"/>
        </g>`;
    const file = (id) => `
        <g id="${id}" class="lm-item">
            <rect x="-6" y="-8.5" width="12" height="17" rx="1.5" fill="#d2d4d5" stroke="#ffffff" stroke-opacity="0.7" stroke-width="0.75"/>
            <path d="M2 -8.5 L6 -4.5 H2 Z" fill="#11324a" fill-opacity="0.75"/>
            <line x1="-3.5" y1="-3.5" x2="2.5" y2="-3.5" stroke="#11324a" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="-3.5" y1="0.5" x2="3.5" y2="0.5" stroke="#752d4b" stroke-width="1.1" stroke-linecap="round"/>
            <line x1="-3.5" y1="4.5" x2="1" y2="4.5" stroke="#8c9190" stroke-width="1" stroke-linecap="round"/>
        </g>`;
    return `
<svg class="lm-svg" viewBox="-6 16 112 78" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    <defs>
        <linearGradient id="lm-text-grad" x1="0%" y1="0%" x2="100%" y2="0%" spreadMethod="repeat">
            <stop class="lm-s1" offset="0%" stop-color="#d2d4d5"/>
            <stop class="lm-s2" offset="25%" stop-color="#ffffff"/>
            <stop class="lm-s3" offset="50%" stop-color="#a15c88"/>
            <stop class="lm-s4" offset="75%" stop-color="#eec3dd"/>
            <stop class="lm-s5" offset="100%" stop-color="#d2d4d5"/>
        </linearGradient>
        <radialGradient id="lm-drop-grad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="18%" stop-color="#eec3dd"/>
            <stop offset="46%" stop-color="#a15c88"/>
            <stop offset="78%" stop-color="#752d4b"/>
            <stop offset="100%" stop-color="#140a12"/>
        </radialGradient>
        <radialGradient id="lm-eye-depth" cx="50%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#241220"/>
            <stop offset="70%" stop-color="#120911"/>
            <stop offset="100%" stop-color="#0a0509"/>
        </radialGradient>
        <filter id="lm-drop-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5.5" flood-color="#a15c88" flood-opacity="0.8"/>
            <feDropShadow dx="0" dy="3.5" stdDeviation="9" flood-color="#752d4b" flood-opacity="0.5"/>
        </filter>
        <filter id="lm-text-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.2" flood-color="#a15c88" flood-opacity="0.55"/>
        </filter>
        <clipPath id="lm-clip-l"><rect id="lm-lid-l" x="33" y="38" width="16" height="20" rx="7"/></clipPath>
        <clipPath id="lm-clip-r"><rect id="lm-lid-r" x="51" y="38" width="16" height="20" rx="7"/></clipPath>
        <!-- Same circle as the original (r = 37.5) but a longer arc, so 5 letters never run off the path -->
        <path id="lm-text-path" d="M 14 62.6 A 37.5 37.5 0 0 0 86 62.6" fill="none"/>
    </defs>

    <g id="lm-orbit-behind"></g>

    <g id="lm-drop" class="lm-drop" filter="url(#lm-drop-glow)">
        <circle cx="50" cy="46" r="22" fill="url(#lm-drop-grad)" stroke="#ffffff45" stroke-width="1.2"/>
        <path d="M37 32 C41 27 51 27 55 31 C52 29 44 29 39 33 Z" fill="#ffffff" fill-opacity="0.85"/>
        <ellipse cx="42" cy="34" rx="6" ry="3" transform="rotate(-25 42 34)" fill="#ffffff" fill-opacity="0.9"/>
        <circle cx="58" cy="33" r="1.5" fill="#ffffff" fill-opacity="0.95"/>
        <ellipse cx="50" cy="64" rx="10.5" ry="2.2" fill="#d2d4d5" fill-opacity="0.3"/>
        <g clip-path="url(#lm-clip-l)">
            <rect x="36" y="38" width="10" height="13" rx="5" fill="url(#lm-eye-depth)" stroke="#752d4b" stroke-width="0.8"/>
            <ellipse cx="41" cy="49.5" rx="3.5" ry="1.2" fill="#a15c88" fill-opacity="0.9"/>
            <g id="lm-pupil-l">
                <circle cx="41" cy="44" r="3.2" fill="#0d0e05"/>
                <circle cx="39.8" cy="42.3" r="1.3" fill="#ffffff"/>
                <circle cx="42.2" cy="45.5" r="0.65" fill="#eec3dd" fill-opacity="0.8"/>
            </g>
        </g>
        <g clip-path="url(#lm-clip-r)">
            <rect x="54" y="38" width="10" height="13" rx="5" fill="url(#lm-eye-depth)" stroke="#752d4b" stroke-width="0.8"/>
            <ellipse cx="59" cy="49.5" rx="3.5" ry="1.2" fill="#a15c88" fill-opacity="0.9"/>
            <g id="lm-pupil-r">
                <circle cx="59" cy="44" r="3.2" fill="#0d0e05"/>
                <circle cx="57.8" cy="42.3" r="1.3" fill="#ffffff"/>
                <circle cx="60.2" cy="45.5" r="0.65" fill="#eec3dd" fill-opacity="0.8"/>
            </g>
        </g>
        <path d="M48 53.5 Q50 55.2 52 53.5" stroke="#1c1f12" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    </g>

    <g id="lm-orbit-front">${folder("lm-f1")}${file("lm-d1")}${folder("lm-f2")}${file("lm-d2")}</g>

    <g id="lm-wobble" filter="url(#lm-text-glow)">
        <text class="lm-text" fill="url(#lm-text-grad)">
            <textPath href="#lm-text-path" startOffset="50%" text-anchor="middle">${LUMEN_NAME}</textPath>
        </text>
    </g>
</svg>`;
}

function initLumenLogo() {
    const host = $(".logo");
    if (!host) return;
    host.setAttribute("role", "img");
    host.setAttribute("aria-label", "Lumen");
    host.innerHTML = lumenLogoMarkup();

    const gs = window.gsap;
    if (!gs) return; // GSAP failed to load -> logo stays as a static image

    const q = (sel) => host.querySelector(sel);
    const behindG = q("#lm-orbit-behind"),
        frontG = q("#lm-orbit-front"),
        dropEl = q("#lm-drop"),
        pupils = [q("#lm-pupil-l"), q("#lm-pupil-r")],
        lids = [q("#lm-lid-l"), q("#lm-lid-r")],
        wobble = q("#lm-wobble"),
        grad = q("#lm-text-grad");

    const CFG = {
        frontScaleMax: 1.6,
        gazeTravelWidth: 1.2,
        gazeTravelHeight: 0.55,
        speedMultiplier: 1.4,
        baseDuration: 5.6,
        baseOpacity: 0.35,
    };
    const items = [
        { el: q("#lm-f1"), off: 0 },
        { el: q("#lm-d1"), off: Math.PI * 0.5 },
        { el: q("#lm-f2"), off: Math.PI },
        { el: q("#lm-d2"), off: Math.PI * 1.5 },
    ];

    const draw = (t) => {
        const angle = t * Math.PI * 2;
        gs.set(pupils, {
            x: Math.sin(angle) * CFG.gazeTravelWidth,
            y: (1 - Math.cos(angle)) * 0.5 * CFG.gazeTravelHeight,
            transformOrigin: "50% 50%",
        });
        gs.set(dropEl, { rotation: Math.sin(angle) * 4.5, transformOrigin: "50% 50%" });
        const cx = 50, cy = 44, rx = 35.5, ry = 14.5;
        items.forEach(({ el, off }) => {
            const a = angle + off,
                sv = Math.sin(a);
            let sc, op;
            if (sv >= 0) {
                sc = gs.utils.mapRange(0, 1, 1, CFG.frontScaleMax, sv);
                op = gs.utils.mapRange(0, 1, CFG.baseOpacity, CFG.baseOpacity * 1.65, sv);
            } else {
                sc = gs.utils.mapRange(-1, 0, 0.7, 1, sv);
                op = gs.utils.mapRange(-1, 0, CFG.baseOpacity * 0.55, CFG.baseOpacity, sv);
            }
            gs.set(el, {
                x: cx + rx * Math.cos(a),
                y: cy + ry * sv,
                scale: sc,
                rotation: Math.cos(a) * 8.5,
                opacity: op,
                transformOrigin: "50% 50%",
            });
            const want = sv < 0 ? behindG : frontG;
            if (el.parentNode !== want) want.appendChild(el);
        });
    };

    // Respect "reduce motion": draw one calm frame and stop
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) {
        draw(0.1);
        return;
    }

    // 1. Orbit + gaze loop
    const proxy = { t: 0 };
    gs.to(proxy, {
        t: 1,
        duration: CFG.baseDuration / CFG.speedMultiplier,
        ease: "none",
        repeat: -1,
        onUpdate: () => draw(proxy.t),
    });

    // 2. Blink
    gs.timeline({ repeat: -1, repeatDelay: 3.5 })
        .to(lids, { scaleY: 0.08, duration: 0.11, ease: "power2.in", transformOrigin: "50% 50%" })
        .to(lids, { scaleY: 1, duration: 0.15, ease: "power2.out", transformOrigin: "50% 50%" });

    // 3. Liquid colour sweep on the LUMEN text
    const gp = { o: 0 };
    gs.to(gp, {
        o: 100,
        duration: 2.2,
        ease: "none",
        repeat: -1,
        onUpdate: () => {
            grad.setAttribute("x1", gp.o + "%");
            grad.setAttribute("x2", gp.o + 100 + "%");
        },
    });

    // 4. Jelly wobble on the text
    gs.timeline({ repeat: -1 })
        .to(wobble, { scaleX: 1.025, scaleY: 0.975, skewX: -0.7, duration: 0.65, ease: "sine.inOut" })
        .to(wobble, { scaleX: 0.98, scaleY: 1.02, skewX: 0.8, duration: 0.72, ease: "sine.inOut" })
        .to(wobble, { scaleX: 1.01, scaleY: 0.99, skewX: -0.3, duration: 0.58, ease: "sine.inOut" })
        .to(wobble, { scaleX: 1, scaleY: 1, skewX: 0, duration: 0.65, ease: "sine.inOut" });
}
initLumenLogo();

$$("header>*,aside,.bar").forEach((e) => {
    if (!e.matches(".logo,.sp,input")) e.classList.add("ctl");
});
body.classList.add("empty");
mountDrop();
const allDirs = () => {
    const s = new Set(dirs);
    files.forEach((f) => {
        let p = "";
        f.dir
            .split("/")
            .filter(Boolean)
            .forEach((x) => {
                p = p ? p + "/" + x : x;
                s.add(p);
            });
    });
    return [...s].sort();
};
const hi = () => $$(".dir").forEach((el) => el.classList.toggle("on", el.dataset.d === cur));
function tree() {
    const m = new Map([["", 0]]),
        up = (p) => {
            let q = "";
            p.split("/")
                .filter(Boolean)
                .forEach((x) => {
                    q = q ? q + "/" + x : x;
                    m.set(q, m.get(q) || 0);
                });
        };
    files.forEach((f) => {
        m.set("", m.get("") + 1);
        up(f.dir);
        let q = "";
        f.dir
            .split("/")
            .filter(Boolean)
            .forEach((x) => {
                q = q ? q + "/" + x : x;
                m.set(q, m.get(q) + 1);
            });
    });
    dirs.forEach(up);
    const row = (k, n, d, c, i, x = "") =>
        `<div class="dir${x}" data-d="${esc(k)}" style="padding-left:${10 + d * 14}px">${ic(i, 17)}<span>${esc(n)}</span><small>${c}</small></div>`;
    $("#tree").innerHTML =
        row("", title || "Folder", 0, m.get(""), "folder") +
        row("*", "All", 0, m.get(""), "layers") +
        [...m.keys()]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 0, { numeric: true }))
            .map((k) => {
                const mst = multi && !k.includes("/"); // top-level (master) folder of a multi-folder workspace
                return row(k, k.split("/").pop(), k.split("/").length, m.get(k), mst ? "master" : "folder", mst ? " master" : "");
            })
            .join("");
    $$(".dir").forEach((el) => {
        const d = el.dataset.d;
        el.onclick = () => {
            cur = d;
            render(false);
        };
        if (d === "*") return;
        el.ondragover = (e) => {
            if (dragI !== null) {
                e.preventDefault();
                el.classList.add("hot");
            }
        };
        el.ondragleave = () => el.classList.remove("hot");
        el.ondrop = async (e) => {
            if (dragI === null) return;
            e.preventDefault();
            e.stopPropagation();
            el.classList.remove("hot");
            body.classList.remove("mvg", "over");
            const f = list[dragI];
            dragI = null;
            moveMany(sel.has(f) ? [...sel] : [f], d); // dragging a selected file moves the whole selection
        };
    });
    hi();
}
// in a multi-folder workspace the title is the live number of top-level folders
function syncTitle() {
    if (!multi || body.classList.contains("empty")) return;
    const n = topNames().size;
    title = n ? n + (n === 1 ? " folder" : " folders") : "Files";
}
const _r = render;
render = function (b) {
    syncTitle();
    const c = cur,
        all = c === "*" || !!q;
    if (all) {
        cur = "";
        sub = true;
    } else sub = false;
    _r(b);
    cur = c;
    hi();
    $("#crumb").textContent = (title || "") + (c === "*" ? " / All" : c ? " / " + c : "");
    $$("[data-i].card,[data-i].row").forEach((e) => (e.draggable = true));
    if (!all && type === "all") tiles(c);
};
const nf = (k) => k + (k === 1 ? " file" : " files");
function tiles(c) {
    const ch = allDirs().filter((d) => (d.includes("/") ? d.slice(0, d.lastIndexOf("/")) : "") === c);
    if (!ch.length) return;
    const n = (d) => files.filter((f) => f.dir === d || f.dir.startsWith(d + "/")).length,
        box = $("#content");
    let g = box.querySelector(".grid,.list");
    if (!g) {
        box.innerHTML = '<div class="' + (view === "grid" ? "grid" : "list") + '"></div>';
        g = box.firstChild;
    }
    g.insertAdjacentHTML(
        "afterbegin",
        ch
            .map((d, i) => {
                const nm = esc(d.split("/").pop()),
                    k = `style="--d:${i * 22}ms"`;
                return view === "grid"
                    ? `<div class="card fd a" data-f="${esc(d)}" ${k}><div class="th e">${ic("folder", 54, 1.4)}</div><div class="nm">${nm}<small>${nf(n(d))}</small></div></div>`
                    : `<div class="row fd a" data-f="${esc(d)}" ${k}><div class="th e">${ic("folder", 22)}</div><span class="n">${nm}</span><span class="p"></span><span class="s">${nf(n(d))}</span></div>`;
            })
            .join(""),
    );
}
$("#content").addEventListener("click", (e) => {
    const t = e.target.closest("[data-f]");
    if (t) {
        cur = t.dataset.f;
        render(false);
    }
});
$("#content").addEventListener("dragstart", (e) => {
    const t = e.target.closest && e.target.closest("[data-i]");
    if (!t) return;
    dragI = +t.dataset.i;
    body.classList.add("mvg");
    e.dataTransfer.setData("text/plain", "x");
    e.dataTransfer.effectAllowed = "move";
});
addEventListener("dragend", () => {
    dragI = null;
    body.classList.remove("mvg");
    overOff();
});
/* ---------- File-operation animations ----------
   fly   : cards fly into a sidebar folder (move / copy) or into a button (download)
   poof  : cards crumble away with a little particle burst (delete)
   smooth: after any change, the cards that stay glide to their new spots (FLIP)
   fresh : files that just appeared / were renamed get a pop or glow on the next render */
const fresh = new Map(); // file -> "new" | "ren" | "mv"
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE = "cubic-bezier(.65,0,.35,1)";
const dirEl = (d) => $$(".dir").find((e) => e.dataset.d === d);
const rectOf = (x, y) => ({ left: x, top: y, width: 0, height: 0 });
// visible cards / rows of the given files, in page order
const cardsOf = (fs) => {
    const s = new Set(fs),
        cr = $("#content").getBoundingClientRect();
    return $$(".card[data-i],.row[data-i]").filter((el) => {
        if (!s.has(list[+el.dataset.i])) return false;
        const r = el.getBoundingClientRect();
        return r.width && r.bottom > cr.top && r.top < cr.bottom;
    });
};
function pulseEl(t, c = "#a15c88") {
    if (!t) return;
    t.animate(
        [
            { transform: "scale(1.12)", boxShadow: `0 0 0 0 ${c}cc` },
            { transform: "none", boxShadow: `0 0 0 14px ${c}00` },
        ],
        { duration: 420, easing: "ease-out" },
    );
}
function floatTxt(r, text, bg) {
    const e = document.createElement("div");
    e.textContent = text;
    Object.assign(e.style, {
        position: "fixed",
        left: r.left + r.width / 2 + "px",
        top: r.top + "px",
        padding: "2px 10px",
        borderRadius: "99px",
        background: bg || "var(--ac)",
        color: "#fff",
        fontSize: "13px",
        fontWeight: 600,
        zIndex: 96,
        pointerEvents: "none",
    });
    body.append(e);
    e.animate(
        [
            { opacity: 0, transform: "translate(-50%,0) scale(.6)" },
            { opacity: 1, transform: "translate(-50%,-14px) scale(1)", offset: 0.25 },
            { opacity: 0, transform: "translate(-50%,-40px) scale(1)" },
        ],
        { duration: 950, easing: "ease-out" },
    ).onfinish = () => e.remove();
}
// ghosts of `els` travel along a curve to the target rect `tr`. keep:true leaves the originals in place (copy / download)
function flyTo(els, tr, o = {}) {
    if (RM) return Promise.resolve();
    const MAX = 40,
        step = Math.min(50, 600 / Math.max(els.length, 1)),
        tx = tr.left + tr.width / 2,
        ty = tr.top + tr.height / 2;
    return Promise.all(
        els.map(
            (el, i) =>
                new Promise((ok) => {
                    if (i >= MAX) {
                        if (!o.keep) {
                            el.style.transition = "opacity .4s";
                            el.style.opacity = 0;
                        }
                        return ok();
                    }
                    const a = el.getBoundingClientRect(),
                        g = el.cloneNode(true),
                        rot = ((i % 5) - 2) * 4,
                        delay = i * step;
                    g.classList.remove("a", "sel", "fresh-new", "fresh-ren", "fresh-mv");
                    g.classList.add("gh");
                    const sc = g.querySelector(".sc");
                    if (sc) sc.remove();
                    Object.assign(g.style, {
                        position: "fixed",
                        left: a.left + "px",
                        top: a.top + "px",
                        width: a.width + "px",
                        height: a.height + "px",
                        margin: 0,
                        zIndex: 95,
                        pointerEvents: "none",
                        transformOrigin: "center",
                    });
                    body.append(g);
                    if (o.keep) el.animate([{ filter: "brightness(1.6)" }, { filter: "none" }], { duration: 450, delay });
                    else el.style.opacity = ".15";
                    const dx = tx - (a.left + a.width / 2),
                        dy = ty - (a.top + a.height / 2);
                    g.animate(
                        [
                            { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
                            {
                                transform: `translate(${dx * 0.35}px,${dy * 0.35 - 46}px) scale(.8) rotate(${rot}deg)`,
                                opacity: 1,
                                offset: 0.38,
                            },
                            { transform: `translate(${dx}px,${dy}px) scale(.07) rotate(${rot * 2}deg)`, opacity: 0.3 },
                        ],
                        { duration: o.dur || 650, delay, easing: EASE, fill: "both" },
                    ).onfinish = () => {
                        g.remove();
                        if (o.hit) o.hit();
                        ok();
                    };
                }),
        ),
    );
}
// move / copy: fly the files' cards into the sidebar folder `d`
async function flyMany(fs, d, o = {}) {
    const els = cardsOf(fs);
    if (!els.length) return;
    let t = dirEl(d);
    if (t) t.scrollIntoView({ block: "nearest" });
    let tr = t && t.getBoundingClientRect();
    if (!tr || !tr.width) {
        t = null; // sidebar hidden (phones): fly off the top edge instead
        tr = rectOf(innerWidth / 2, -20);
    }
    await flyTo(els, tr, { ...o, hit: () => t && pulseEl(t) });
    if (t && o.label) floatTxt(tr, o.label);
}
// download: fly into the Download button of the selection bar, or off the bottom edge
async function flyDl(fs) {
    const els = cardsOf(fs),
        b = sb.classList.contains("on") && $('#sb [data-a="zip"]');
    if (!els.length) return;
    await flyTo(els, b ? b.getBoundingClientRect() : rectOf(innerWidth / 2, innerHeight + 30), {
        keep: true,
        hit: () => b && pulseEl(b),
    });
}
function burst(r, cols) {
    const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2 + 10;
    for (let k = 0; k < 8; k++) {
        const p = document.createElement("div"),
            ang = (k / 8) * Math.PI * 2 + Math.random() * 0.5,
            dist = 26 + Math.random() * 30,
            s = 4 + Math.random() * 5;
        Object.assign(p.style, {
            position: "fixed",
            left: cx + "px",
            top: cy + "px",
            width: s + "px",
            height: s + "px",
            borderRadius: "50%",
            background: cols[k % cols.length],
            zIndex: 96,
            pointerEvents: "none",
        });
        body.append(p);
        p.animate(
            [
                { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
                {
                    transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px),calc(-50% + ${Math.sin(ang) * dist}px)) scale(0)`,
                    opacity: 0,
                },
            ],
            { duration: 480 + Math.random() * 200, easing: "cubic-bezier(.2,.8,.3,1)" },
        ).onfinish = () => p.remove();
    }
}
// delete: each card swells a touch, then shrinks away in a puff of particles
function poof(els) {
    if (RM) return Promise.resolve();
    const MAX = 40,
        step = Math.min(40, 500 / Math.max(els.length, 1)),
        cols = ["#c0392b", "#e8837a", "#a15c88"];
    return Promise.all(
        els.map(
            (el, i) =>
                new Promise((ok) => {
                    const delay = i * step;
                    if (i >= MAX) {
                        el.style.transition = "opacity .3s";
                        el.style.opacity = 0;
                        return ok();
                    }
                    const r = el.getBoundingClientRect(),
                        rot = (i % 2 ? 1 : -1) * (6 + (i % 4) * 2);
                    if (i < 24) setTimeout(() => burst(r, cols), delay + 330);
                    el.animate(
                        [
                            { transform: "none", opacity: 1, filter: "none" },
                            { transform: "scale(1.07) rotate(-2deg)", opacity: 1, filter: "none", offset: 0.22 },
                            { transform: `translateY(26px) scale(.15) rotate(${rot}deg)`, opacity: 0, filter: "blur(6px)" },
                        ],
                        { duration: 520, delay, easing: "ease-in", fill: "both" },
                    ).onfinish = ok;
                }),
        ),
    );
}
// FLIP: run `fn` (which re-renders), then glide every card that survived from its old spot to its new one
function smooth(fn) {
    const c = $("#content"),
        st = c.scrollTop,
        first = new Map(),
        all = () => c.querySelectorAll(".card[data-i],.row[data-i]");
    all().forEach((el) => {
        const f = list[+el.dataset.i];
        if (f) first.set(f, el.getBoundingClientRect());
    });
    fn();
    if (st) c.scrollTop = st;
    if (RM) return;
    all().forEach((el) => {
        const a = first.get(list[+el.dataset.i]);
        if (!a) return;
        el.getAnimations().forEach((x) => x.animationName === "up" && x.cancel());
        const b = el.getBoundingClientRect(),
            dx = a.left - b.left,
            dy = a.top - b.top;
        if (Math.abs(dx) + Math.abs(dy) < 1) return;
        el.animate(
            [
                { transformOrigin: "0 0", transform: `translate(${dx}px,${dy}px)` },
                { transformOrigin: "0 0", transform: "none" },
            ],
            { duration: 560, easing: "cubic-bezier(.22,1,.36,1)" },
        );
    });
}
// a freshly created sidebar folder slides in
function growRow(d) {
    const t = dirEl(d);
    if (!t || RM) return Promise.resolve();
    t.scrollIntoView({ block: "nearest" });
    return t.animate(
        [
            { opacity: 0, transform: "translateX(-26px) scale(.9)", boxShadow: "0 0 0 0 #a15c88cc" },
            { opacity: 1, transform: "none", boxShadow: "0 0 0 14px #a15c8800" },
        ],
        { duration: 650, easing: "cubic-bezier(.34,1.56,.64,1)" },
    ).finished.catch(() => {});
}
const done = (m) => {
    smooth(() => render());
    save();
    toast(m);
};
const dl = async (f) => {
    const a = document.createElement("a");
    a.href = await url(f);
    a.download = f.name;
    a.click();
};
const flush = (r) => {
    if (dirty && edf) {
        const b0 = snap();
        edf.blob = new Blob([$("#ed").value]);
        edf.size = edf.blob.size;
        edf.p = null;
        dirty = 0;
        save();
        rec("Edit " + edf.name, b0);
        toast("Saved");
        if (r) render(false);
    }
};
$("#ed").oninput = () => (dirty = 1);
$("#sv").onclick = () => flush(1);
async function edit(i, w, off) {
    const f = list[i];
    if (!f) return;
    const t = await f.blob.text();
    if (t.includes("\0")) {
        toast("Binary file: it can’t be shown as text");
        return;
    }
    await open(i);
    $("#mp").hidden = $("#mv").hidden = true;
    $("#mi").style.display = "none";
    $("#stage").classList.add("txt");
    const ed = $("#ed");
    edf = f;
    dirty = 0;
    ed.value = t;
    ed.readOnly = !w;
    ed.hidden = false;
    $("#sv").hidden = !w;
    ed.focus();
    if (w) {
        const o = Math.min(off ?? t.length, t.length);
        ed.setSelectionRange(o, o);
    }
}
const NO = new Set("doc docx pages rar zip heic heif tiff tif".split(" "));
const _o = open;
open = async function (i) {
    flush();
    $("#ed").hidden = $("#sv").hidden = true;
    await _o(i);
    const f = list[idx],
        k = kind(f),
        mv = $("#mv");
    if ((k === "vid" || k === "aud") && !mv.hidden) {
        const u = await url(f);
        if (list[idx] === f) player(mv, u, k === "vid" ? "video" : "audio");
    } else if (k === "oth" && NO.has(f.ext)) {
        $("#mp").hidden = true;
        mv.hidden = false;
        mv.innerHTML = `<p class="msg">${f.ext === "zip" ? "Right-click this file and choose Extract here to browse it." : "Browsers can’t preview ." + f.ext + " files. Use Download to open it in another app."}</p>`;
    }
};
$("#mx").onclick = () => {
    flush(1);
    close();
};
$("#modal").onclick = (e) => {
    if (e.target.id === "modal") {
        flush(1);
        close();
    }
};
function player(box, u, tg) {
    box.innerHTML = `<div class="pl ${tg}">${tg === "video" ? "" : '<div class="disc"></div>'}<${tg} src="${u}" playsinline></${tg}><div class="pc"><button class="ib" data-a="p"></button><span class="tm">0:00</span><input type="range" class="sk" min="0" max="1000" value="0"><span class="tm d">0:00</span><button class="ib" data-a="m"></button><input type="range" class="vl" min="0" max="1" step=".05" value="1"><button class="ib" data-a="s">1×</button>${tg === "video" ? '<button class="ib" data-a="f"></button>' : ""}</div></div>`;
    const w = box.firstChild,
        m = w.querySelector(tg),
        g = (s) => w.querySelector(s),
        pb = g("[data-a=p]"),
        mb = g("[data-a=m]"),
        sk = g(".sk"),
        vl = g(".vl"),
        sp = g("[data-a=s]"),
        fb = g("[data-a=f]"),
        R = [1, 1.25, 1.5, 2, 0.75],
        t = (s) => {
            s = ~~s;
            return ~~(s / 60) + ":" + String(s % 60).padStart(2, "0");
        },
        pr = (el) => el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min)) * 100 + "%");
    const sy = () => {
        pb.innerHTML = ic(m.paused ? "play" : "pause", 20);
        mb.innerHTML = ic(m.muted || !m.volume ? "mute" : "vol", 20);
        w.classList.toggle("playing", !m.paused);
    };
    sy();
    pr(sk);
    pr(vl);
    pb.onclick = () => (m.paused ? m.play() : m.pause());
    if (tg === "video") m.onclick = pb.onclick;
    m.onplay = m.onpause = m.onvolumechange = sy;
    m.ontimeupdate = () => {
        sk.value = (m.currentTime / (m.duration || 1)) * 1000;
        pr(sk);
        g(".tm").textContent = t(m.currentTime);
    };
    m.onloadedmetadata = () => (g(".d").textContent = t(m.duration));
    sk.oninput = () => {
        m.currentTime = (sk.value / 1000) * m.duration;
        pr(sk);
    };
    vl.oninput = () => {
        m.volume = vl.value;
        m.muted = false;
        pr(vl);
    };
    mb.onclick = () => (m.muted = !m.muted);
    sp.onclick = () => {
        m.playbackRate = R[(R.indexOf(m.playbackRate) + 1) % R.length];
        sp.textContent = m.playbackRate + "×";
    };
    if (fb) {
        fb.innerHTML = ic("full", 20);
        fb.onclick = () => w.requestFullscreen && w.requestFullscreen();
    }
    m.play().catch(() => {});
}
async function clash(p, self) {
    let q = p;
    for (;;) {
        const o = files.find((f) => f !== self && f.path === q);
        if (!o) return q;
        const r = await dlg({
            t: "File already exists",
            m: "“" + q.split("/").pop() + "” is already in this folder.",
            b: [
                ["Cancel", null],
                ["Change name", "n"],
                ["Replace", "r", "dng"],
            ],
        });
        if (!r) return null;
        if (r === "r") {
            files = files.filter((f) => f !== o);
            return q;
        }
        const dir = q.includes("/") ? q.slice(0, q.lastIndexOf("/") + 1) : "",
            nn = await dlg({
                t: "Choose a new name",
                v: uniq(q).split("/").pop(),
                b: [
                    ["Cancel", null],
                    ["Save", "ok", "pri"],
                ],
            });
        if (!nn) return null;
        q = dir + nn.replace(/\//g, "-");
    }
}
function moveFile(f, i, d) {
    return moveMany([f], d);
}
async function newFile() {
    const n = await dlg({
        t: "New file",
        v: "untitled.txt",
        b: [
            ["Cancel", null],
            ["Create", "ok", "pri"],
        ],
    });
    if (!n) return;
    const p = await clash(base() + n.replace(/^\/+/, ""), null);
    if (p === null) return;
    add(p, new Blob([]));
    const f = files[files.length - 1];
    if (f && f.path === p) fresh.set(f, "new");
    smooth(() => render());
    save();
    const i = f && f.path === p ? list.indexOf(f) : -1;
    if (i >= 0) edit(i, 1);
}
async function newDir() {
    const n = await dlg({
        t: "New folder",
        v: "",
        b: [
            ["Cancel", null],
            ["Create", "ok", "pri"],
        ],
    });
    if (!n) return;
    const p = base() + n.replace(/^\/+|\/+$/g, "");
    if (allDirs().includes(p)) return toast("That folder already exists");
    dirs.add(p);
    done("Folder created");
    growRow(p);
}
let delDir = async (d) => {
    if (
        !(await dlg({
            t: "Move folder to bin",
            m: "“" + d + "” and everything inside it will go to the Bin. You can restore it from there.",
            b: [
                ["Cancel", false],
                ["Move to bin", true, "dng"],
            ],
        }))
    )
        return;
    const inside = files.filter((f) => f.dir === d || f.dir.startsWith(d + "/")),
        tile = $$("[data-f]").find((e) => e.dataset.f === d);
    await flyBin([dirEl(d), tile, ...cardsOf(inside)].filter(Boolean));
    const gone = [...dirs].filter((x) => x === d || x.startsWith(d + "/"));
    bin.push({ id: ++binId, kind: "dir", path: d, items: inside.map((f) => ({ f, path: f.path })), dirs: gone, at: Date.now() });
    files = files.filter((f) => !(f.dir === d || f.dir.startsWith(d + "/")));
    gone.forEach((x) => dirs.delete(x));
    {
        const gf = new Set(inside),
            gd = new Set(gone);
        scrubHist((x) => {
            x.files = x.files.filter((r) => !gf.has(r[0]));
            x.dirs = x.dirs.filter((p) => !gd.has(p) && !(p === d || p.startsWith(d + "/")));
        });
    }
    cur = "";
    $("#content").scrollTop = 0;
    updBin();
    done("Folder moved to the bin");
};
const fileMenu = (i) => {
    const f = list[i],
        mv = [
            ...(f.dir ? [{ t: title || "Main folder", i: "folder", f: () => moveFile(f, i, "") }] : []),
            ...allDirs()
                .filter((d) => d !== f.dir)
                .map((d) => ({ t: d, i: "folder", f: () => moveFile(f, i, d) })),
        ];
    if (mv.length) mv.push(null);
    mv.push({
        t: "New folder…",
        i: "newf",
        f: async () => {
            const n = await dlg({
                t: "New folder",
                m: "The file will move into it.",
                v: "",
                b: [
                    ["Cancel", null],
                    ["Create & move", "ok", "pri"],
                ],
            });
            if (n) moveFile(f, i, base() + n.replace(/^\/+|\/+$/g, ""));
        },
    });
    return [
        { t: sel.has(f) ? "Deselect" : "Select", i: "sel", f: () => toggle(f) },
        { t: "Open", i: "eye", f: () => open(i) },
        { t: "Read as text", i: "files", f: () => edit(i, 0) },
        { t: "Write / append", i: "pen", f: () => edit(i, 1) },
        null,
        { t: "Rename", i: "pen", f: () => renameFile(f) },
        { t: "Move to", i: "go", sub: mv },
        { t: "Copy to", i: "copy", sub: destItems((d) => copyMany([f], d)) },
        {
            t: "Download",
            i: "download",
            f: async () => {
                await flyDl([f]);
                dl(f);
            },
        },
        ...(f.ext === "zip"
            ? [
                  {
                      t: "Extract here",
                      i: "zip",
                      f: () =>
                          ingest([[f.name, f.blob, (f.dir ? f.dir + "/" : "") + f.name.replace(/\.zip$/i, "") + "/"]], title, {
                              merge: 1,
                          }),
                  },
              ]
            : []),
        null,
        { t: "Delete", i: "trash", d: 1, f: () => delMany([f]) },
    ];
};
const dirMenu = (d) => [
    { t: "New file", i: "newfile", f: newFile },
    { t: "New folder", i: "newf", f: newDir },
    { t: "Add files here", i: "plus", f: () => $("#fAny").click() },
    ...(d ? [null, { t: "Delete folder", i: "trash", d: 1, f: () => delDir(d) }] : []),
];
const cm = $("#cm"),
    hideCm = () => cm.classList.remove("on");
function menu(x, y, it) {
    const row = (a, k) =>
        !a
            ? "<hr>"
            : `<div class="mi"><button style="--d:${k * 22}ms" class="${a.d ? "dng" : ""}" data-k="${k}">${ic(a.i, 17)}<span>${a.t}</span>${a.sub ? ic("chr", 15) : ""}</button>${a.sub ? '<div class="sm">' + a.sub.map((s, j) => (s ? `<button data-k="${k}.${j}">${ic(s.i, 16)}<span>${esc(s.t)}</span></button>` : "<hr>")).join("") + "</div>" : ""}</div>`;
    cm.innerHTML = it.map(row).join("");
    cm.classList.remove("on", "fl");
    cm.style.left = Math.max(8, Math.min(x, innerWidth - cm.offsetWidth - 8)) + "px";
    cm.style.top = Math.max(8, Math.min(y, innerHeight - cm.offsetHeight - 8)) + "px";
    if (x + cm.offsetWidth + 210 > innerWidth) cm.classList.add("fl");
    void cm.offsetWidth;
    cm.classList.add("on");
    cm.onclick = (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        const [k, j] = b.dataset.k.split("."),
            a = j === undefined ? it[k] : it[k].sub[j];
        if (a.sub) return;
        hideCm();
        a.f();
    };
}
document.addEventListener(
    "contextmenu",
    (e) => {
        e.preventDefault();
        if (body.classList.contains("empty") || e.target.closest("#modal,#dg")) return hideCm();
        const c = e.target.closest("[data-i]"),
            t = e.target.closest("[data-f]"),
            d = e.target.closest(".dir"),
            X = e.clientX,
            Y = e.clientY,
            R = (p) => (p === "*" ? "" : p);
        if (e.target.closest(".dir.bin,#bBin")) return menu(X, Y, binMenu());
        if (cur === BIN && !d) {
            const bi = e.target.closest("[data-b]");
            return menu(X, Y, bi ? binItemMenu(bi.dataset.b) : binMenu());
        }
        if (c) {
            const sf = list[+c.dataset.i];
            menu(X, Y, sel.has(sf) && sel.size > 1 ? selMenu() : fileMenu(+c.dataset.i));
        }
        else if (t) {
            cur = t.dataset.f;
            render(false);
            menu(X, Y, dirMenu(cur));
        } else if (d) {
            cur = d.dataset.d;
            render(false);
            menu(X, Y, dirMenu(R(cur)));
        } else if (e.target.closest("section")) menu(X, Y, dirMenu(R(cur)));
        else hideCm();
    },
    true,
);
addEventListener("click", hideCm);
addEventListener("scroll", hideCm, true);
addEventListener("resize", hideCm);
addEventListener(
    "keydown",
    (e) => {
        if (e.key === "Escape") {
            hideCm();
            flush(1);
        } else if (e.target.id === "ed" || e.target.tagName === "INPUT") e.stopPropagation();
    },
    true,
);
$("#bAdd").onclick = async () => {
    const r = await dlg({
        t: "Add to this workspace",
        m: "Folders and zips become new top-level folders. Tip: you can also drag and drop any mix of folders, zips and files onto the page.",
        b: [["Cancel", null], ["Files", "f"], ["Zip files", "z"], ["Folder", "d", "pri"]],
    });
    if (r === "f") $("#fAny").click();
    else if (r === "z") $("#fZip").click();
    else if (r === "d") $("#fFolder").click();
};
$("#bNew").onclick = newDir;
$("#bZipDl").onclick = async () => {
    if (!files.length && !dirs.size) return toast("Nothing to download yet");
    flush(1);
    showLd("Zipping " + title, "Packing");
    const z = new JSZip();
    dirs.forEach((d) => z.folder(d));
    files.forEach((f) => z.file(f.path, f.blob));
    try {
        const b = await z.generateAsync({ type: "blob" }, (m) => setP(m.percent)),
            a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = (title || "lumen") + ".zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 9e3);
    } catch (e) {
        await dlg({ t: "Couldn’t create the zip", m: e.message, b: [["OK", true, "pri"]] });
    }
    hideLd();
};
$("#bReset").onclick = async () => {
    if (
        !(await dlg({
            t: "Close this folder?",
            m: "“" + title + "” will be removed from this browser. Download the zip first if you need your edits.",
            b: [
                ["Cancel", false],
                ["Close folder", true, "dng"],
            ],
        }))
    )
        return;
    files = [];
    dirs = new Set();
    cur = "";
    title = "";
    multi = false;
    sel.clear();
    upd();
    bin = [];
    binSel.clear();
    hist.length = redoSt.length = 0;
    leaveBinView();
    updBin();
    updHist();
    idb("delete", "s");
    body.classList.add("empty");
    body.classList.remove("rv");
    mountDrop();
    $("#crumb").textContent = "";
    $("#count").textContent = "";
    close();
};
const stp = (d) => {
    sz.value = +sz.value + d;
    sz.oninput();
};
$(".szw [data-ic=mc]").onclick = () => stp(-30);
$(".szw [data-ic=pc]").onclick = () => stp(30);
(async () => {
    const s = await idb("get", "s");
    if (!s || !s.files || (!s.files.length && !(s.bin && s.bin.length))) return;
    title = s.name || "Folder";
    multi = !!s.multi;
    dirs = new Set(s.dirs || []);
    files = [];
    s.files.forEach((x) => add(x.path, x.b));
    loadBin(s.bin);
    body.classList.remove("empty");
    body.classList.add("rv");
    $$(".ctl").forEach((e, i) => e.style.setProperty("--n", i));
    render();
})();

/* ---------- Report a problem (Formspree) ---------- */
IC.check = '<path d="m5 12 5 5 9-10"/>';
body.insertAdjacentHTML(
    "beforeend",
    `<div id="rp"><form id="rf" action="https://formspree.io/f/xoejarwj" method="POST">
    <div class="rh"><span class="ri">${ic("flag", 22)}</span><div><h4>Report a problem</h4><p>A file type that won’t open, or something broken? Tell us and we’ll look into it.</p></div><button type="button" class="ib" id="rx" data-tip="Close">${ic("close")}</button></div>
    <label style="--d:70ms"><span>Your name</span><input name="name" required maxlength="80" autocomplete="name" placeholder="Your name"></label>
    <label style="--d:120ms"><span>Email <em>optional</em></span><input name="email" type="email" maxlength="120" autocomplete="email" placeholder="you@example.com"></label>
    <label style="--d:170ms"><span>What’s the issue?</span><textarea name="message" required rows="4" maxlength="2000" placeholder="e.g. .xyz files don’t open, or a preview looks wrong…"></textarea></label>
    <input type="hidden" name="_subject" value="Lumen issue report">
    <input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
    <p class="re" id="re" role="alert"></p>
    <div class="ra" style="--d:220ms"><button type="button" id="rc">Cancel</button><button type="submit" class="rs" id="rs"><span>Send report</span></button></div>
</form></div>
<div id="ok"><div class="cd"><svg class="ck" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="25"/><path d="m21 33 8 8 15-17"/></svg><h4>Reported successfully</h4><p>Thanks! Your report has been sent.</p></div></div>`,
);
const rp = $("#rp"),
    okBox = $("#ok");
let okT;
const openReport = () => {
    $("#re").textContent = "";
    rp.classList.add("on");
    setTimeout(() => $('#rf [name="name"]').focus(), 350);
};
const closeReport = () => rp.classList.remove("on");
const showOk = () => {
    okBox.classList.add("on");
    clearTimeout(okT);
    okT = setTimeout(() => okBox.classList.remove("on"), 3000);
};
$("#bReport").onclick = openReport;
$("#rx").onclick = $("#rc").onclick = closeReport;
rp.addEventListener("mousedown", (e) => {
    if (e.target === rp) closeReport();
});
okBox.onclick = () => {
    clearTimeout(okT);
    okBox.classList.remove("on");
};
addEventListener(
    "keydown",
    (e) => {
        if (!rp.classList.contains("on")) return;
        if (e.key === "Escape") closeReport();
        e.stopPropagation();
    },
    true,
);
$("#rf").addEventListener("submit", async (e) => {
    e.preventDefault(); // stay on the page instead of going to formspree.io
    const f = e.target,
        btn = $("#rs"),
        err = $("#re");
    err.textContent = "";
    btn.disabled = true;
    btn.classList.add("busy");
    try {
        const r = await fetch(f.action, { method: "POST", body: new FormData(f), headers: { Accept: "application/json" } });
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error((j.errors || []).map((x) => x.message).join(" ") || "Something went wrong. Please try again.");
        }
        f.reset();
        closeReport();
        setTimeout(showOk, 420);
    } catch (x) {
        err.textContent = x instanceof TypeError ? "Couldn’t reach the server. Check your connection and try again." : x.message;
        f.classList.remove("shake");
        void f.offsetWidth;
        f.classList.add("shake");
    }
    btn.disabled = false;
    btn.classList.remove("busy");
});

/* ---------- Multi-select: check files, then move / copy / download / delete them together ---------- */
Object.assign(IC, {
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    sel: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
});
const sel = new Set(); // selected file objects (they survive re-renders and folder changes)
body.insertAdjacentHTML(
    "beforeend",
    `<div id="sb"><b id="sbn"></b>
    <button data-a="all">${ic("sel", 17)}<span>Select all</span></button>
    <button data-a="move">${ic("go", 17)}<span>Move</span></button>
    <button data-a="copy">${ic("copy", 17)}<span>Copy</span></button>
    <button data-a="zip">${ic("download", 17)}<span>Download</span></button>
    <button data-a="del" class="dng">${ic("trash", 17)}<span>Delete</span></button>
    <button data-a="clr" title="Clear selection">${ic("close", 17)}</button></div>`,
);
$("#count").insertAdjacentHTML("beforebegin", `<button class="ib" id="bSel" data-tip="Select all">${ic("sel", 20)}</button>`);
const sb = $("#sb"),
    bSel = $("#bSel");

// little 5° tilt and back; the independent `rotate` property composes with the card's hover transform
const tilt = (els) =>
    els.forEach((el) =>
        el.animate([{ rotate: "0deg" }, { rotate: "5deg" }, { rotate: "0deg" }], {
            duration: 450,
            easing: "cubic-bezier(.34,1.56,.64,1)",
        }),
    );
const cardOf = (f) => {
    const i = list.indexOf(f);
    return i < 0 ? null : $(`.card[data-i="${i}"],.row[data-i="${i}"]`);
};
const allSelected = () => list.length > 0 && list.every((f) => sel.has(f));
function upd() {
    const n = sel.size,
        on = n > 0 && !body.classList.contains("empty"),
        all = allSelected();
    sb.classList.toggle("on", on);
    body.classList.toggle("selmode", on);
    $("#sbn").textContent = n + " selected";
    $('#sb [data-a="all"] span').textContent = all ? "Deselect all" : "Select all";
    bSel.classList.toggle("on", all);
    bSel.dataset.tip = all ? "Deselect all" : "Select all";
}
function toggle(f, force) {
    const on = force ?? !sel.has(f),
        el = cardOf(f);
    on ? sel.add(f) : sel.delete(f);
    if (el) {
        el.classList.toggle("sel", on);
        tilt([el]);
    }
    upd();
}
// every file of the folder being viewed, all tilting at the same moment
function selectAll(on) {
    const els = $$(".card[data-i],.row[data-i]");
    list.forEach((f) => (on ? sel.add(f) : sel.delete(f)));
    els.forEach((el) => el.classList.toggle("sel", on));
    tilt(els);
    upd();
}
function clearSel() {
    const els = $$(".card.sel,.row.sel");
    sel.clear();
    els.forEach((el) => el.classList.remove("sel"));
    tilt(els);
    upd();
}
// scribble checkbox (box + hand-drawn tick that draws itself / un-draws itself, driven by the .sel class in CSS)
const SCRIBBLE =
    '<svg viewBox="0 0 95 95" aria-hidden="true"><rect class="bx" x="22" y="22" width="54" height="54" rx="12"/>' +
    '<g transform="translate(0,-952.36222)"><path class="path1" d="m 56,963 c -102,122 6,9 7,9 17,-5 -66,69 -38,52 122,-77 -7,14 18,4 29,-11 45,-43 23,-4"/></g></svg>';
const _r2 = render;
render = function (b) {
    _r2(b);
    const all = new Set(files);
    [...sel].forEach((f) => all.has(f) || sel.delete(f));
    $$(".card[data-i],.row[data-i]").forEach((el) => {
        el.insertAdjacentHTML("afterbegin", `<span class="sc">${SCRIBBLE}</span>`);
        el.classList.toggle("sel", sel.has(list[+el.dataset.i]));
    });
    if (fresh.size) {
        let k = 0;
        $$(".card[data-i],.row[data-i]").forEach((el) => {
            const kind = fresh.get(list[+el.dataset.i]);
            if (!kind) return;
            el.style.setProperty("--fd", Math.min(k++ * 50, 500) + "ms");
            el.classList.add("fresh-" + kind);
            const nm = kind === "ren" && el.querySelector(".nm,.n");
            if (nm && !RM)
                nm.animate(
                    [
                        { opacity: 0, transform: "translateY(10px)", filter: "blur(5px)", letterSpacing: ".2em" },
                        { opacity: 1, transform: "none", filter: "none", letterSpacing: "0" },
                    ],
                    { duration: 520, delay: 120, easing: "cubic-bezier(.22,1,.36,1)", fill: "backwards" },
                );
        });
        fresh.clear();
    }
    upd();
};

// clicking the check box (or any file while a selection exists, or Ctrl/Cmd+click) selects instead of opening
document.addEventListener(
    "click",
    (e) => {
        const c = e.target.closest(".card[data-i],.row[data-i]");
        if (!c || !$("#content").contains(c)) return;
        if (e.target.closest(".sc") || sel.size || e.ctrlKey || e.metaKey) {
            e.stopPropagation();
            e.preventDefault();
            hideCm();
            toggle(list[+c.dataset.i]);
        }
    },
    true,
);
bSel.onclick = () => selectAll(!allSelected());
addEventListener(
    "keydown",
    (e) => {
        if (body.classList.contains("empty") || cur === BIN || ["#modal", "#dg", "#rp"].some((s) => $(s).classList.contains("on"))) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !/INPUT|TEXTAREA/.test(e.target.tagName)) {
            e.preventDefault();
            selectAll(true);
        } else if (e.key === "Escape" && sel.size) clearSel();
    },
    true,
);

// ----- bulk operations -----
const destItems = (act) => [
    { t: multi ? "Top level" : title || "Main folder", i: "folder", f: () => act("") },
    ...allDirs().map((d) => ({ t: d, i: "folder", f: () => act(d) })),
    null,
    {
        t: "New folder…",
        i: "newf",
        f: async () => {
            const n = await dlg({
                t: "New folder",
                m: "The files will go into it.",
                v: "",
                b: [["Cancel", null], ["Create", "ok", "pri"]],
            });
            if (n) act(base() + n.replace(/^\/+|\/+$/g, ""));
        },
    },
];
const nFiles = (k) => k + (k === 1 ? " file" : " files");
const where = (d) => d || (multi ? "top level" : title);
async function newTarget(d) {
    if (d && !allDirs().includes(d)) {
        dirs.add(d);
        tree();
        await growRow(d);
    }
}
async function moveMany(fs, d) {
    await newTarget(d);
    const moved = [];
    for (const f of fs) {
        const np = (d ? d + "/" : "") + f.name;
        if (np === f.path) continue;
        const p = await clash(np, f); // Replace / Change name / Cancel (Cancel skips just this file)
        if (p === null) continue;
        setPath(f, p);
        fresh.set(f, "mv");
        moved.push(f);
    }
    await flyMany(moved, d, { label: "+" + moved.length });
    sel.clear();
    done(moved.length ? "Moved " + nFiles(moved.length) + " to " + where(d) : "Nothing to move");
}
async function copyMany(fs, d) {
    await newTarget(d);
    const src = [];
    let k = 0;
    for (const f of fs) {
        const np = (d ? d + "/" : "") + f.name;
        const p = np === f.path ? uniq(np) : await clash(np, null);
        if (p === null) continue;
        add(p, f.blob);
        const nf = files[files.length - 1];
        if (nf && nf.path === p) fresh.set(nf, "new");
        src.push(f);
        k++;
    }
    await flyMany(src, d, { keep: true, label: "+" + k });
    sel.clear();
    done("Copied " + nFiles(k) + " to " + where(d));
}
async function delMany(fs) {
    const m = fs.length === 1 ? "“" + fs[0].name + "” will go to the Bin. You can restore it from there." : fs.length + " files will go to the Bin. You can restore them from there.";
    if (!(await dlg({ t: "Move to bin", m, b: [["Cancel", false], ["Move to bin", true, "dng"]] }))) return;
    await flyBin(cardsOf(fs));
    const s = new Set(fs),
        at = Date.now();
    files = files.filter((f) => !s.has(f));
    scrubHist((x) => (x.files = x.files.filter((r) => !s.has(r[0]))));
    fs.forEach((f) => bin.push({ id: ++binId, kind: "file", f, path: f.path, at }));
    sel.clear();
    updBin();
    done("Moved " + nFiles(fs.length) + " to the bin");
}
async function zipMany(fs) {
    await flyDl(fs);
    if (fs.length === 1) return dl(fs[0]);
    showLd("Zipping selection", nFiles(fs.length));
    const z = new JSZip();
    fs.forEach((f) => z.file(f.path, f.blob));
    try {
        const b = await z.generateAsync({ type: "blob" }, (m) => setP(m.percent)),
            a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = (title || "lumen") + "-selection.zip";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 9e3);
    } catch (e) {
        await dlg({ t: "Couldn’t create the zip", m: e.message, b: [["OK", true, "pri"]] });
    }
    hideLd();
}
const selMenu = () => {
    const fs = [...sel];
    return [
        { t: fs.length + " selected", i: "sel", f: () => {} },
        null,
        { t: "Move to", i: "go", sub: destItems((d) => moveMany(fs, d)) },
        { t: "Copy to", i: "copy", sub: destItems((d) => copyMany(fs, d)) },
        { t: "Download as zip", i: "download", f: () => zipMany(fs) },
        null,
        { t: "Deselect all", i: "close", f: clearSel },
        { t: "Delete " + fs.length + " files", i: "trash", d: 1, f: () => delMany(fs) },
    ];
};
sb.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    e.stopPropagation();
    hideCm();
    const a = b.dataset.a,
        fs = [...sel];
    if (a === "all") selectAll(!allSelected());
    else if (a === "clr") clearSel();
    else if (a === "del") delMany(fs);
    else if (a === "zip") zipMany(fs);
    else {
        const r = b.getBoundingClientRect();
        menu(r.left, r.top, destItems((d) => (a === "move" ? moveMany : copyMany)(fs, d)));
        cm.style.top = Math.max(8, r.top - cm.offsetHeight - 8) + "px"; // open above the bar
    }
});
/* ======================================================================
   Bin · Undo / Redo
   - Deleted files and folders go to the Bin (sidebar + navbar) instead of vanishing.
   - Restore puts every item back exactly where it was deleted from.
   - Undo / Redo (navbar, Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y) revert any operation.
   Animations:  delete -> cards fly into the Bin · restore -> glowing arcs back to their folder
                empty / delete forever -> cards spiral down the drain, Bin shakes
   ====================================================================== */
const HMAX = 60; // undo steps kept
const nItems = (k) => k + (k === 1 ? " item" : " items");
const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
const binFiles = (b) => (b.kind === "dir" ? b.items.map((x) => x.f) : [b.f]);
const cloneBin = (b) => ({ ...b, items: b.items && b.items.map((x) => ({ ...x })), dirs: b.dirs && [...b.dirs] });

/* ---------- history: a snapshot before + after every operation ---------- */
function snap() {
    // the Bin is deliberately NOT part of history: deleting, restoring and deleting forever are never undone / redone
    return { files: files.map((f) => [f, f.path, f.blob]), dirs: [...dirs], title, multi };
}
// when a bin operation changes which files exist, patch every saved snapshot so undo/redo never resurrects or drops them
const scrubHist = (fn) => [...hist, ...redoSt].forEach((h) => (fn(h.b), fn(h.a)));
const sameBin = (x, y) =>
    x.id === y.id &&
    x.path === y.path &&
    (x.kind !== "dir" ||
        (x.items.length === y.items.length &&
            x.items.every((it, i) => it.f === y.items[i].f && it.path === y.items[i].path) &&
            x.dirs.length === y.dirs.length &&
            x.dirs.every((d, i) => d === y.dirs[i])));
function sameSnap(a, b) {
    return (
        a.title === b.title &&
        a.multi === b.multi &&
        a.files.length === b.files.length &&
        a.files.every((x, i) => x[0] === b.files[i][0] && x[1] === b.files[i][1] && x[2] === b.files[i][2]) &&
        a.dirs.length === b.dirs.length &&
        a.dirs.every((d, i) => d === b.dirs[i])
    );
}
function pushHist(label, b, a) {
    hist.push({ label, b, a });
    if (hist.length > HMAX) hist.shift();
    redoSt.length = 0;
    updHist();
}
function rec(label, before) {
    const after = snap();
    if (!sameSnap(before, after)) pushHist(label, before, after);
}
let txD = 0;
// wraps an operation so it becomes one undo step (nested operations are folded into the outer one)
const tx = (label, fn) =>
    async function (...a) {
        if (txD) return fn.apply(this, a);
        const lab = typeof label === "function" ? label(...a) : label,
            b = snap();
        txD++;
        try {
            return await fn.apply(this, a);
        } finally {
            txD--;
            rec(lab, b);
        }
    };
function applySnap(s) {
    const was = new Map(files.map((f) => [f, f.path]));
    files = s.files.map(([f, p, bl]) => {
        if (!was.has(f)) fresh.set(f, "new");
        else if (was.get(f) !== p) fresh.set(f, "mv");
        if (f.path !== p) setPath(f, p);
        if (f.blob !== bl) {
            f.blob = bl;
            f.size = bl.size;
            f.p = f.hv = f.ff = null;
        }
        return f;
    });
    dirs = new Set(s.dirs);
    title = s.title;
    multi = s.multi;
    if (cur && cur !== "*" && cur !== BIN && !allDirs().includes(cur)) cur = "";
    smooth(() => render());
    save();
}
function stepHist(dir) {
    if (txD || body.classList.contains("empty")) return;
    flush();
    const from = dir < 0 ? hist : redoSt,
        to = dir < 0 ? redoSt : hist,
        h = from.pop();
    if (!h) return;
    to.push(h);
    applySnap(dir < 0 ? h.b : h.a);
    updHist();
    toast((dir < 0 ? "Undid · " : "Redid · ") + h.label);
    pulseEl($(dir < 0 ? "#bUndo" : "#bRedo"));
}
function updHist() {
    const u = $("#bUndo"),
        r = $("#bRedo"),
        hu = hist[hist.length - 1],
        hr = redoSt[redoSt.length - 1];
    u.disabled = !hu;
    r.disabled = !hr;
    u.dataset.tip = hu ? "Undo · " + hu.label + " (Ctrl+Z)" : "Nothing to undo";
    r.dataset.tip = hr ? "Redo · " + hr.label + " (Ctrl+Shift+Z)" : "Nothing to redo";
}
$("#bUndo").onclick = () => stepHist(-1);
$("#bRedo").onclick = () => stepHist(1);
addEventListener(
    "keydown",
    (e) => {
        if (body.classList.contains("empty") || ["#modal", "#dg", "#rp"].some((s) => $(s).classList.contains("on"))) return;
        if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
        if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) {
            e.preventDefault();
            stepHist(-1);
        } else if ((k === "z" && e.shiftKey) || k === "y") {
            e.preventDefault();
            stepHist(1);
        }
    },
    true,
);

/* ---------- saving the bin between visits ---------- */
function serBin() {
    return bin.map((b) =>
        b.kind === "dir"
            ? { k: "d", id: b.id, path: b.path, at: b.at, dirs: b.dirs, items: b.items.map((x) => ({ path: x.path, b: x.f.blob })) }
            : { k: "f", id: b.id, path: b.path, at: b.at, b: b.f.blob },
    );
}
function mkFile(path, blob) {
    const i = path.lastIndexOf("/"),
        name = path.slice(i + 1);
    return {
        path,
        name,
        dir: i < 0 ? "" : path.slice(0, i),
        ext: name.includes(".") ? name.split(".").pop().toLowerCase() : "",
        size: blob.size,
        blob,
        get() {
            return this.blob;
        },
        p: null,
    };
}
function loadBin(a) {
    bin = (a || []).map((x) =>
        x.k === "d"
            ? { id: x.id, kind: "dir", path: x.path, at: x.at, dirs: x.dirs || [], items: x.items.map((y) => ({ f: mkFile(y.path, y.b), path: y.path })) }
            : { id: x.id, kind: "file", path: x.path, at: x.at, f: mkFile(x.path, x.b) },
    );
    binId = bin.reduce((m, b) => Math.max(m, b.id), 0);
}

/* ---------- Bin button, badge and sidebar row ---------- */
const binRowEl = () => $(".dir.bin");
const binTarget = () => [binRowEl(), $("#bBin")].find((e) => e && e.getBoundingClientRect().width);
function updBin() {
    const n = bin.length,
        bd = $("#bBinN");
    bd.textContent = n > 99 ? "99+" : n;
    bd.classList.toggle("on", n > 0);
    $("#bBin").dataset.tip = n ? "Bin · " + nItems(n) : "Bin";
    $$(".dir.bin small").forEach((s) => (s.textContent = n));
    if (body.classList.contains("binview")) updBinBar();
}
// the Bin wobbles like a lid slammed shut (add) or pops open (restore)
function binGulp(add = true) {
    if (RM) return;
    const c = add ? "#a15c88" : "#4cc38a";
    [binRowEl(), $("#bBin")].forEach((e) => {
        if (!e || !e.getBoundingClientRect().width) return;
        e.animate(
            [
                { transform: "none", boxShadow: `0 0 0 0 ${c}cc` },
                { transform: "scale(1.2) rotate(-9deg)", boxShadow: `0 0 0 6px ${c}55`, offset: 0.3 },
                { transform: "scale(.94) rotate(5deg)", boxShadow: `0 0 0 12px ${c}22`, offset: 0.62 },
                { transform: "none", boxShadow: `0 0 0 16px ${c}00` },
            ],
            { duration: 560, easing: "cubic-bezier(.34,1.56,.64,1)" },
        );
    });
}
const _tree = tree;
tree = function () {
    _tree();
    const el = document.createElement("div");
    el.className = "dir bin" + (cur === BIN ? " on" : "");
    el.dataset.d = BIN;
    el.style.paddingLeft = "10px";
    el.innerHTML = `${ic("bin", 17)}<span>Bin</span><small>${bin.length}</small>`;
    el.onclick = () => (cur === BIN ? closeBin() : openBin());
    // drag files onto the Bin to delete them
    el.ondragover = (e) => {
        if (dragI !== null) {
            e.preventDefault();
            el.classList.add("hot");
        }
    };
    el.ondragleave = () => el.classList.remove("hot");
    el.ondrop = (e) => {
        if (dragI === null) return;
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove("hot");
        body.classList.remove("mvg", "over");
        const f = list[dragI];
        dragI = null;
        delMany(sel.has(f) ? [...sel] : [f]);
    };
    $("#tree").append(el);
};
$("#bBin").onclick = () => (cur === BIN ? closeBin() : openBin());
function openBin() {
    if (body.classList.contains("empty")) return;
    flush(1);
    if (cur !== BIN) prevCur = cur;
    cur = BIN;
    sel.clear();
    upd();
    render(false);
    $("#content").scrollTop = 0;
}
function closeBin() {
    cur = prevCur && prevCur !== BIN ? prevCur : "";
    render(false);
}
function leaveBinView() {
    body.classList.remove("binview");
    $("#bBin").classList.remove("on");
    binSel.clear();
    binIO && binIO.disconnect();
}
const _r3 = render;
render = function (b) {
    if (cur === BIN) return renderBin(b);
    if (body.classList.contains("binview")) leaveBinView();
    _r3(b);
};

/* ---------- Bin view ---------- */
$("#crumb").insertAdjacentHTML(
    "afterend",
    `<div id="binTools"><button class="bt" id="binRes">${ic("restore", 17)}<span>Restore all</span></button><button class="bt dng" id="binDel" hidden>${ic("trash", 17)}<span>Delete forever</span></button><button class="bt dng" id="binEmpty">${ic("bin", 17)}<span>Empty bin</span></button></div>`,
);
const BIN_EMPTY = `<div class="empty bin-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><g class="lid"><path d="M4 7h16M9 7l.7-3h4.6L15 7"/></g><path d="M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg><b>The bin is empty</b><span>Deleted files and folders wait here until you restore them or empty the bin.</span></div>`;
const ago = (t) => {
    const s = (Date.now() - t) / 1000;
    return s < 45 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : Math.round(s / 86400) + " d ago";
};
const fromLbl = (b) => dirOf(b.path) || (multi ? "top level" : title || "main folder");
const bName = (b) => (b.kind === "dir" ? b.path.split("/").pop() : b.f.name);
const bSize = (b) => (b.kind === "dir" ? nFiles(b.items.length) : fmt(b.f.size));
function binItems() {
    const s = q.toLowerCase();
    return [...bin]
        .filter(
            (b) =>
                (!s || b.path.toLowerCase().includes(s)) &&
                (type === "all" || (b.kind === "file" && (type === "svg" ? b.f.ext === "svg" : isImg(b.f)))),
        )
        .sort((a, b) => b.at - a.at || a.id - b.id);
}
let binIO;
function binLazy() {
    binIO && binIO.disconnect();
    binIO = new IntersectionObserver(
        (es) =>
            es.forEach(async (e) => {
                if (!e.isIntersecting) return;
                const t = e.target;
                binIO.unobserve(t);
                const b = bin.find((x) => x.id === +t.dataset.bi);
                if (!b) return;
                t.onload = t.onerror = () => {
                    t.classList.add("ld");
                    b.f.ld = 1;
                };
                if (b.f.ld) t.style.transition = "none";
                t.src = await show(b.f);
            }),
        { root: $("#content"), rootMargin: "600px" },
    );
    $$("#content .lz[data-bi]").forEach((i) => binIO.observe(i));
}
function renderBin(rebuild) {
    if (rebuild !== false) tree();
    const c = $("#content"),
        was = body.classList.contains("binview"),
        st = was ? c.scrollTop : 0,
        first = new Map();
    if (was) $$("#content [data-b]").forEach((el) => first.set(el.dataset.b, el.getBoundingClientRect()));
    body.classList.add("binview");
    $("#bBin").classList.add("on");
    const items = binItems();
    binList = items;
    items.forEach((b) => b.kind === "file" && b.f.path !== b.path && setPath(b.f, b.path)); // so the preview shows where it came from
    list = items.filter((b) => b.kind === "file").map((b) => b.f);
    hi();
    $("#crumb").textContent = (title || "") + " / Bin";
    $("#count").textContent = nItems(items.length);
    binIO && binIO.disconnect();
    if (!items.length) {
        c.innerHTML = bin.length ? '<div class="empty">No matching items</div>' : BIN_EMPTY;
        return updBinBar();
    }
    const th = (b) => {
        if (b.kind === "dir") return `<div class="th e">${ic("folder", view === "grid" ? 54 : 22, 1.4)}</div>`;
        if (kind(b.f) === "img") return `<div class="th"><img class="lz" alt="" data-bi="${b.id}"></div>`;
        return `<div class="th e"><span class="ext">${esc((b.f.ext || "file").slice(0, 5).toUpperCase())}</span></div>`;
    };
    let k = 0;
    const an = (b) => (first.has(String(b.id)) ? "" : k < 48 ? `a" style="--d:${k++ * 22}ms` : ""),
        tip = (b) => esc("Deleted from " + fromLbl(b) + " · " + ago(b.at));
    c.innerHTML =
        view === "grid"
            ? `<div class="grid">${items.map((b) => `<div class="card bn ${an(b)}" data-b="${b.id}" title="${tip(b)}">${th(b)}<div class="nm">${esc(bName(b))}<small>${bSize(b)} · from ${esc(fromLbl(b))}</small></div></div>`).join("")}</div>`
            : `<div class="list">${items.map((b) => `<div class="row bn ${an(b)}" data-b="${b.id}" title="${tip(b)}">${th(b)}<span class="n">${esc(bName(b))}</span><span class="p">from ${esc(fromLbl(b))}</span><span class="s">${bSize(b)}</span></div>`).join("")}</div>`;
    $$("#content .card[data-b],#content .row[data-b]").forEach((el) => {
        el.insertAdjacentHTML("afterbegin", `<span class="sc">${SCRIBBLE}</span>`);
        el.classList.toggle("sel", binSel.has(+el.dataset.b));
    });
    if (st) c.scrollTop = st;
    if (!RM && first.size)
        $$("#content [data-b]").forEach((el) => {
            const a = first.get(el.dataset.b);
            if (!a) return;
            const r = el.getBoundingClientRect(),
                dx = a.left - r.left,
                dy = a.top - r.top;
            if (Math.abs(dx) + Math.abs(dy) < 1) return;
            el.animate(
                [
                    { transformOrigin: "0 0", transform: `translate(${dx}px,${dy}px)` },
                    { transformOrigin: "0 0", transform: "none" },
                ],
                { duration: 560, easing: "cubic-bezier(.22,1,.36,1)" },
            );
        });
    binLazy();
    updBinBar();
}
function updBinBar() {
    const n = binSel.size,
        has = bin.length > 0;
    $("#binRes span").textContent = n ? "Restore " + n : "Restore all";
    $("#binRes").disabled = !has;
    $("#binDel").hidden = !n;
    $("#binDel span").textContent = n > 1 ? "Delete " + n + " forever" : "Delete forever";
    $("#binEmpty").disabled = !has;
}
function toggleBin(id) {
    binSel.has(id) ? binSel.delete(id) : binSel.add(id);
    const el = $(`#content [data-b="${id}"]`);
    if (el) {
        el.classList.toggle("sel", binSel.has(id));
        tilt([el]);
    }
    updBinBar();
}
function previewBin(id) {
    const b = bin.find((x) => x.id === id),
        i = b && b.kind === "file" ? list.indexOf(b.f) : -1;
    if (i >= 0) open(i);
}
const binTargets = (id) => {
    const b = bin.find((x) => x.id === +id);
    return b && binSel.has(b.id) && binSel.size > 1 ? bin.filter((x) => binSel.has(x.id)) : b ? [b] : [];
};
// same behaviour as the file list: click opens, tick box (or any click while something is ticked) selects
$("#content").addEventListener("click", (e) => {
    if (cur !== BIN) return;
    const el = e.target.closest("[data-b]");
    if (!el) return;
    const id = +el.dataset.b,
        b = bin.find((x) => x.id === id);
    if (!b) return;
    if (e.target.closest(".sc") || binSel.size || e.ctrlKey || e.metaKey || b.kind === "dir") toggleBin(id);
    else previewBin(id);
});
addEventListener(
    "keydown",
    (e) => {
        if (cur !== BIN || ["#modal", "#dg", "#rp"].some((s) => $(s).classList.contains("on"))) return;
        if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
            e.preventDefault();
            binList.forEach((b) => binSel.add(b.id));
            $$("#content [data-b]").forEach((el) => el.classList.add("sel"));
            tilt($$("#content [data-b]"));
            updBinBar();
        } else if (e.key === "Escape" && binSel.size) {
            binSel.clear();
            $$("#content .sel").forEach((el) => el.classList.remove("sel"));
            updBinBar();
        }
    },
    true,
);
$("#binRes").onclick = () => restoreBin(binSel.size ? bin.filter((b) => binSel.has(b.id)) : [...bin]);
$("#binDel").onclick = () => purgeBin(bin.filter((b) => binSel.has(b.id)));
$("#binEmpty").onclick = () => emptyBin();
function binItemMenu(id) {
    const ts = binTargets(id),
        b = ts[0],
        many = ts.length > 1;
    if (!b) return [];
    return [
        { t: many ? "Restore " + ts.length + " items" : "Restore", i: "restore", f: () => restoreBin(ts) },
        ...(b.kind === "file" && !many ? [{ t: "Open", i: "eye", f: () => previewBin(b.id) }] : []),
        { t: binSel.has(b.id) ? "Deselect" : "Select", i: "sel", f: () => toggleBin(b.id) },
        null,
        { t: many ? "Delete " + ts.length + " forever" : "Delete forever", i: "trash", d: 1, f: () => purgeBin(ts) },
    ];
}
function binMenu() {
    return [
        ...(cur === BIN ? [] : [{ t: "Open bin", i: "bin", f: openBin }]),
        { t: "Restore all", i: "restore", f: () => restoreBin([...bin]) },
        null,
        { t: "Empty bin", i: "trash", d: 1, f: () => emptyBin() },
    ];
}

/* ---------- animations ---------- */
const bnCards = (its) => {
    const ids = new Set(its.map((b) => b.id)),
        cr = $("#content").getBoundingClientRect();
    return $$("#content .card[data-b],#content .row[data-b]").filter((el) => {
        if (!ids.has(+el.dataset.b)) return false;
        const r = el.getBoundingClientRect();
        return r.width && r.bottom > cr.top && r.top < cr.bottom;
    });
};
// delete -> cards fly into the Bin (sidebar row, or the navbar button when the sidebar is hidden)
function flyBin(els) {
    const t = binTarget(),
        tr = t ? t.getBoundingClientRect() : rectOf(innerWidth / 2, -20);
    return flyTo(els, tr, { dur: 620 }).then(() => binGulp(true));
}
function ghostOf(el) {
    const a = el.getBoundingClientRect(),
        g = el.cloneNode(true);
    g.classList.remove("a", "sel", "fresh-new", "fresh-ren", "fresh-mv");
    g.classList.add("gh");
    const sc = g.querySelector(".sc");
    if (sc) sc.remove();
    Object.assign(g.style, {
        position: "fixed",
        left: a.left + "px",
        top: a.top + "px",
        width: a.width + "px",
        height: a.height + "px",
        margin: 0,
        zIndex: 95,
        pointerEvents: "none",
        transformOrigin: "center",
    });
    body.append(g);
    return [g, a];
}
// sparkles that fly INTO a point (the opposite of burst())
function converge(r, cols) {
    const cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
    for (let k = 0; k < 9; k++) {
        const p = document.createElement("div"),
            ang = (k / 9) * Math.PI * 2 + Math.random() * 0.6,
            dist = 34 + Math.random() * 34,
            s = 3 + Math.random() * 4;
        Object.assign(p.style, { position: "fixed", left: cx + "px", top: cy + "px", width: s + "px", height: s + "px", borderRadius: "50%", background: cols[k % cols.length], boxShadow: `0 0 8px ${cols[k % cols.length]}`, zIndex: 96, pointerEvents: "none" });
        body.append(p);
        p.animate(
            [
                { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px),calc(-50% + ${Math.sin(ang) * dist}px)) scale(.2)`, opacity: 0 },
                { opacity: 1, offset: 0.35 },
                { transform: "translate(-50%,-50%) scale(1)", opacity: 0 },
            ],
            { duration: 520 + Math.random() * 160, easing: "cubic-bezier(.4,0,.2,1)" },
        ).onfinish = () => p.remove();
    }
}
// restore -> each card lifts off with a glow, loops up in an arc and lands in the folder it came from
function restoreFly(fl) {
    if (RM || !fl.length) return Promise.resolve();
    const step = Math.min(70, 700 / fl.length),
        glow = "drop-shadow(0 0 14px #4cc38a)";
    let shown = false;
    return Promise.all(
        fl.slice(0, 30).map(
            ({ el, to }, i) =>
                new Promise((ok) => {
                    const row = [dirEl(to), dirEl("")].find((e) => e && e.getBoundingClientRect().width);
                    if (row) row.scrollIntoView({ block: "nearest" });
                    const tr = row ? row.getBoundingClientRect() : rectOf(innerWidth / 2, -20),
                        [g, a] = ghostOf(el),
                        dx = tr.left + tr.width / 2 - (a.left + a.width / 2),
                        dy = tr.top + tr.height / 2 - (a.top + a.height / 2),
                        delay = i * step;
                    el.style.opacity = ".12";
                    if (i < 14) setTimeout(() => converge(a, ["#4cc38a", "#a15c88", "#ffffff"]), delay);
                    g.animate(
                        [
                            { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1, filter: "none" },
                            { transform: "translate(0,-28px) scale(1.14) rotate(-3deg)", opacity: 1, filter: glow, offset: 0.2 },
                            { transform: `translate(${dx * 0.5}px,${dy * 0.5 - 90}px) scale(.72) rotate(9deg)`, opacity: 1, filter: glow, offset: 0.6 },
                            { transform: `translate(${dx}px,${dy}px) scale(.08) rotate(0deg)`, opacity: 0.25, filter: glow },
                        ],
                        { duration: 1000, delay, easing: "cubic-bezier(.3,.7,.4,1)", fill: "both" },
                    ).onfinish = () => {
                        g.remove();
                        if (row) pulseEl(row, "#4cc38a");
                        converge(tr, ["#4cc38a", "#ffffff"]);
                        if (!shown) {
                            shown = true;
                            floatTxt(tr, "Restored", "#2e9e6b");
                        }
                        ok();
                    };
                }),
        ),
    );
}
// empty bin / delete forever -> cards are sucked down the drain in a spiral, then the Bin shakes
function swirlAway(els, all) {
    const t = binTarget(),
        tr = t ? t.getBoundingClientRect() : rectOf(innerWidth / 2, innerHeight + 30),
        tx0 = tr.left + tr.width / 2,
        ty0 = tr.top + tr.height / 2,
        finale = () => {
            [binRowEl(), $("#bBin")].forEach((e) => {
                if (!e || !e.getBoundingClientRect().width || RM) return;
                e.animate(
                    [
                        { transform: "translateX(0) rotate(0)" },
                        { transform: "translateX(-5px) rotate(-8deg)" },
                        { transform: "translateX(5px) rotate(8deg)" },
                        { transform: "translateX(-4px) rotate(-5deg)" },
                        { transform: "translateX(3px) rotate(3deg)" },
                        { transform: "none" },
                    ],
                    { duration: all ? 650 : 420, easing: "ease-in-out" },
                );
            });
            if (RM) return;
            burst(tr, ["#6b6f6e", "#8c9190", "#c0392b"]);
            if (all) floatTxt(tr, "Emptied", "#c0392b");
        };
    if (RM || !els.length) {
        finale();
        return Promise.resolve();
    }
    const step = Math.min(35, 500 / els.length);
    return Promise.all(
        els.slice(0, 40).map(
            (el, i) =>
                new Promise((ok) => {
                    const [g, a] = ghostOf(el),
                        cx = a.left + a.width / 2,
                        cy = a.top + a.height / 2,
                        vx = cx - tx0,
                        vy = cy - ty0,
                        kf = [];
                    el.style.opacity = "0";
                    for (let s = 0; s <= 12; s++) {
                        const u = s / 12,
                            e = Math.pow(u, 1.5),
                            r = Math.pow(1 - e, 1.25),
                            th = e * Math.PI * 2.2;
                        kf.push({
                            transform: `translate(${tx0 + (vx * Math.cos(th) - vy * Math.sin(th)) * r - cx}px,${ty0 + (vx * Math.sin(th) + vy * Math.cos(th)) * r - cy}px) rotate(${(th * 180) / Math.PI}deg) scale(${1 - 0.94 * e})`,
                            opacity: 1 - Math.pow(u, 3),
                            filter: `grayscale(${e}) brightness(${1 - 0.5 * e}) blur(${(e * 3).toFixed(1)}px)`,
                            offset: u,
                        });
                    }
                    g.animate(kf, { duration: 950, delay: i * step, easing: "linear", fill: "both" }).onfinish = () => {
                        g.remove();
                        ok();
                    };
                }),
        ),
    ).then(finale);
}

/* ---------- operations ---------- */
async function restoreBin(its) {
    its = its.filter((b) => bin.includes(b));
    if (!its.length) return;
    const restored = [],
        removed = new Set(),
        flights = [];
    for (const b of its) {
        const rows = b.kind === "dir" ? b.items : [{ f: b.f, path: b.path }],
            got = new Set();
        for (const x of rows) {
            const p = await clash(x.path, null); // asks Replace / Change name / Cancel if something is already there
            if (p === null) continue;
            setPath(x.f, p);
            files.push(x.f);
            fresh.set(x.f, "new");
            restored.push(x.f);
            got.add(x.f);
        }
        if (b.kind === "dir" && (got.size || !rows.length)) [b.path, ...b.dirs].forEach((d) => dirs.add(d));
        const left = rows.filter((x) => !got.has(x.f));
        if (!left.length) removed.add(b);
        else if (b.kind === "dir") b.items = left; // some files were skipped: they stay in the bin
        if (got.size || !rows.length) {
            const el = $(`#content [data-b="${b.id}"]`),
                f0 = rows.find((x) => got.has(x.f));
            if (el) flights.push({ el, to: f0 ? dirOf(f0.f.path) : b.path });
        }
    }
    bin = bin.filter((b) => !removed.has(b));
    {
        // restored items exist again: add them to saved snapshots so earlier undo steps keep them
        const rd = new Set();
        its.forEach((b) => b.kind === "dir" && [b.path, ...b.dirs].forEach((d) => dirs.has(d) && rd.add(d)));
        scrubHist((x) => {
            restored.forEach((f) => x.files.push([f, f.path, f.blob]));
            rd.forEach((d) => x.dirs.includes(d) || x.dirs.push(d));
        });
    }
    binSel.clear();
    tree(); // folders that were gone exist again, so the cards can fly to them
    updBin();
    await restoreFly(flights);
    binGulp(false);
    const dests = new Set(restored.map((f) => f.dir)),
        msg = restored.length
            ? "Restored " + nFiles(restored.length) + (dests.size === 1 ? " to " + where([...dests][0]) : " to their original places")
            : removed.size
              ? "Restored " + removed.size + (removed.size === 1 ? " folder" : " folders")
              : "Nothing restored";
    done(msg);
}
async function purgeBin(its) {
    its = its.filter((b) => bin.includes(b));
    if (!its.length) return;
    const m = (its.length === 1 ? "“" + bName(its[0]) + "” will be removed from the bin." : its.length + " items will be removed from the bin.") + " This can’t be undone.";
    if (!(await dlg({ t: "Delete forever?", m, b: [["Cancel", false], ["Delete forever", true, "dng"]] }))) return;
    await swirlAway(bnCards(its), false);
    const s = new Set(its);
    bin = bin.filter((b) => !s.has(b));
    binSel.clear();
    updBin();
    done("Deleted " + nItems(its.length) + " forever");
}
async function emptyBin() {
    if (!bin.length) return toast("The bin is already empty");
    const n = bin.reduce((k, b) => k + binFiles(b).length, 0);
    if (!(await dlg({ t: "Empty the bin?", m: "All " + nFiles(n) + " in the bin will be removed forever. This can’t be undone.", b: [["Cancel", false], ["Empty bin", true, "dng"]] }))) return;
    await swirlAway(bnCards(bin), true);
    bin = [];
    binSel.clear();
    updBin();
    done("Bin emptied");
}
async function renameFile(f) {
    const n = await dlg({
        t: "Rename file",
        v: f.name,
        b: [
            ["Cancel", null],
            ["Rename", "ok", "pri"],
        ],
    });
    if (!n || n === f.name) return;
    const p = await clash((f.dir ? f.dir + "/" : "") + n.replace(/\//g, "-"), f);
    if (p === null) return;
    const el = cardOf(f),
        nm = el && el.querySelector(".nm,.n");
    if (nm && !RM)
        await nm
            .animate(
                [
                    { opacity: 1, transform: "none", filter: "none" },
                    { opacity: 0, transform: "translateY(-10px)", filter: "blur(5px)" },
                ],
                { duration: 200, easing: "ease-in", fill: "forwards" },
            )
            .finished.catch(() => {});
    setPath(f, p);
    fresh.set(f, "ren");
    done("Renamed");
}

/* ---------- every operation becomes one undo step ---------- */
moveMany = tx((fs) => "Move " + nFiles(fs.length), moveMany);
copyMany = tx((fs) => "Copy " + nFiles(fs.length), copyMany);
// delete, folder delete, restore, delete forever and empty bin are intentionally NOT undo steps
renameFile = tx((f) => "Rename " + f.name, renameFile);
newFile = tx("New file", newFile);
newDir = tx("New folder", newDir);
addLoose = tx("Add files", addLoose);
{
    const _ingest = ingest,
        _ingestTx = tx((o) => "Extract zip", _ingest);
    ingest = (out, ttl, o = {}) => (o.merge ? _ingestTx(out, ttl, o) : _ingest(out, ttl, o));
    const _start = start,
        _startTx = tx("Add items", _start);
    // opening the first folder is not an undo step; adding more to an open workspace is
    start = (out, ...r) => (body.classList.contains("empty") ? _start(out, ...r) : _startTx(out, ...r));
}
updHist();
updBin();

/* ======================================================================
   Navigation: Back / Forward + clickable path (breadcrumb)
   ====================================================================== */
let navH = [""], navI = 0, navLast = "", navBusy = false;
const navOk = (d) => d === "" || d === "*" || d === BIN || allDirs().includes(d);
const navFind = (dir) => {
    for (let i = navI + dir; i >= 0 && i < navH.length; i += dir) if (navOk(navH[i])) return i;
    return -1;
};
function navReset() {
    navH = [""];
    navI = 0;
    navLast = "";
}
function navUpd() {
    $("#bBack").disabled = navFind(-1) < 0;
    $("#bFwd").disabled = navFind(1) < 0;
}
function navGo(dir) {
    if (body.classList.contains("empty")) return;
    const i = navFind(dir);
    if (i < 0) return;
    flush(1);
    navI = i;
    const t = navH[i];
    if (t === BIN) {
        if (cur !== BIN) prevCur = cur;
        sel.clear();
        upd();
    }
    navBusy = true;
    cur = t;
    try {
        render(false);
    } finally {
        navBusy = false;
    }
    const c = $("#content");
    c.scrollTop = 0;
}
function navCrumb() {
    const el = $("#crumb"),
        segs = [{ t: title || "Folder", p: "" }];
    if (cur === "*") segs.push({ t: "All", p: "*" });
    else if (cur === BIN) segs.push({ t: "Bin", p: BIN });
    else if (cur) {
        let acc = "";
        cur.split("/").forEach((x) => {
            acc = acc ? acc + "/" + x : x;
            segs.push({ t: x, p: acc });
        });
    }
    el.innerHTML = segs
        .map(
            (s, i) =>
                (i ? '<span class="sep">/</span>' : "") +
                `<button type="button" class="cr${i === segs.length - 1 ? " now" : ""}" data-p="${esc(s.p)}" title="${esc(s.p || "Top level")}">${esc(s.t)}</button>`,
        )
        .join("");
    el.scrollLeft = el.scrollWidth;
}
{
    const _rNav = render;
    render = function (b) {
        _rNav(b);
        if (body.classList.contains("empty")) return;
        if (cur !== navLast) {
            if (!navBusy) {
                navH = navH.slice(0, navI + 1);
                navH.push(cur);
                if (navH.length > 100) navH.shift();
                navI = navH.length - 1;
            }
            navLast = cur;
        }
        navCrumb();
        navUpd();
    };
    const _ingNav = ingest;
    ingest = (out, ttl, o = {}) => {
        if (!o.merge) navReset();
        return _ingNav(out, ttl, o);
    };
}
$("#crumb").addEventListener("click", (e) => {
    const b = e.target.closest(".cr");
    if (!b) return;
    pulseEl(b);
    const p = b.dataset.p;
    if (p === cur) return;
    flush(1);
    cur = p;
    render(false);
    $("#content").scrollTop = 0;
});
$("#bBack").onclick = () => navGo(-1);
$("#bFwd").onclick = () => navGo(1);
const navBlocked = () => ["#modal", "#dg", "#rp"].some((s) => $(s).classList.contains("on"));
addEventListener(
    "keydown",
    (e) => {
        if (!e.altKey || e.ctrlKey || e.metaKey || navBlocked()) return;
        if (/INPUT|TEXTAREA/.test(e.target.tagName) || e.target.isContentEditable) return;
        if (e.key === "ArrowLeft") {
            e.preventDefault();
            navGo(-1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            navGo(1);
        }
    },
    true,
);
// mouse side buttons
addEventListener("mouseup", (e) => {
    if ((e.button !== 3 && e.button !== 4) || navBlocked()) return;
    e.preventDefault();
    navGo(e.button === 3 ? -1 : 1);
});
navUpd();