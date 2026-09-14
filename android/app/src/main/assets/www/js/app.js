(function () {
const sunrise = [
{ color: "#B6D3EF", position: 0 },
{ color: "#CAD1D7", position: 0.153 },
{ color: "#D7CFC8", position: 0.252 },
{ color: "#E1CDB9", position: 0.341 },
{ color: "#EAC6A5", position: 0.424 },
{ color: "#EDB185", position: 0.505 },
{ color: "#EF9B62", position: 0.586 },
{ color: "#F18F60", position: 0.669 },
{ color: "#F48D7A", position: 0.758 },
{ color: "#F78A94", position: 0.857 },
{ color: "#F888A0", position: 1 },
];
const mint = [
{ color: "#DECEE8", position: 0 },
{ color: "#CBBAEE", position: 0.21 },
{ color: "#7DC0FB", position: 0.46 },
{ color: "#00C7A6", position: 1 },
];
const spring = [
{ color: "#F7D5C5", position: 0.07 },
{ color: "#46A8C0", position: 0.58 },
{ color: "#43AE7D", position: 1 },
];
const characterInk = [
{ color: "#12355F", position: 0 },
{ color: "#28689F", position: 0.34 },
{ color: "#783D78", position: 0.68 },
{ color: "#B83273", position: 1 },
];
const easingPresets = {
smooth: "cubic-bezier(0.45, 0, 0.55, 1)",
gentle: "cubic-bezier(0.76, 0, 0.24, 1)",
snappy: "cubic-bezier(0.3, 0, 0.2, 1)",
};
const BAND_CORE_RATIO = 0.44;
const SPREAD_MID_RATIO = 0.72;
const MAX_SPREAD_PX = 48;
const BASE_FONT_PX = 14;
const FALLBACK_TEXT_WIDTH_PX = 96;
function buildBandGradient(stops, angle) {
const sorted = [...stops].sort((a, b) => a.position - b.position);
const first = sorted[0]?.color ?? "white";
const last = sorted[sorted.length - 1]?.color ?? "white";
const core = sorted
.map((stop) => {
const factor = (stop.position - 0.5) * 2 * BAND_CORE_RATIO;
return stop.color + " calc(50% + var(--gs-spread-mid) * " + factor.toFixed(4) + ")";
})
.join(", ");
return [
"linear-gradient(" + angle + "deg",
"var(--gs-base) calc(50% - var(--gs-spread))",
"color-mix(in oklab, var(--gs-base) 42%, " + first + ") calc(50% - var(--gs-spread-mid))",
core,
"color-mix(in oklab, var(--gs-base) 42%, " + last + ") calc(50% + var(--gs-spread-mid))",
"var(--gs-base) calc(50% + var(--gs-spread))",
].join(", ") + ")";
}
function supportsBackgroundClipText() {
if (!window.CSS || typeof window.CSS.supports !== "function") return false;
return (
window.CSS.supports("background-clip", "text") ||
window.CSS.supports("-webkit-background-clip", "text")
);
}
function prefersReducedMotion() {
return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function observeShimmerActive(el, onChange) {
let inViewport = typeof IntersectionObserver === "undefined";
let pageVisible = !document.hidden;
let notScrolling = true;
const compute = () => onChange(inViewport && pageVisible && notScrolling);
let io;
if (typeof IntersectionObserver !== "undefined") {
io = new IntersectionObserver(
(entries) => {
const entry = entries[entries.length - 1];
if (!entry) return;
inViewport = entry.isIntersecting;
compute();
},
{ rootMargin: "160px" }
);
io.observe(el);
}
const onVisibility = () => {
pageVisible = !document.hidden;
compute();
};
document.addEventListener("visibilitychange", onVisibility);
let scrollTimer;
const onScroll = () => {
notScrolling = false;
compute();
clearTimeout(scrollTimer);
scrollTimer = setTimeout(() => {
notScrolling = true;
compute();
}, 120);
};
window.addEventListener("scroll", onScroll, { passive: true, capture: true });
compute();
return () => {
io && io.disconnect();
document.removeEventListener("visibilitychange", onVisibility);
window.removeEventListener("scroll", onScroll, { capture: true });
clearTimeout(scrollTimer);
};
}
function initGradientShimmer(el, options) {
const opts = Object.assign(
{
gradient: sunrise,
easing: "smooth",
duration: 1.45,
spread: 3,
angle: 105,
pauseBetween: 1000,
baseColor: "#c5d4c8",
},
options || {}
);
const children = (el.textContent || "").trim();
const safeDuration = Math.max(0.001, Number(opts.duration) || 1.45);
const safeSpread = Math.max(0, Number(opts.spread) || 3);
const safeAngle = Number.isFinite(opts.angle) ? opts.angle : 105;
const backgroundImage = buildBandGradient(opts.gradient, safeAngle);
const easingValue = easingPresets[opts.easing] || easingPresets.smooth;
const initialSpread = Math.min(children.length * safeSpread, MAX_SPREAD_PX);
el.style.backgroundImage = backgroundImage;
el.style.setProperty("--gs-base", opts.baseColor);
el.style.setProperty("--gs-spread", initialSpread + "px");
el.style.setProperty("--gs-spread-mid", initialSpread * SPREAD_MID_RATIO + "px");
if (!supportsBackgroundClipText()) {
el.style.removeProperty("background-image");
el.style.removeProperty("-webkit-text-fill-color");
return;
}
if (prefersReducedMotion() || typeof el.animate !== "function") return;
const measure = () => {
const textWidth = el.getBoundingClientRect().width || FALLBACK_TEXT_WIDTH_PX;
const fontSize = parseFloat(getComputedStyle(el).fontSize) || BASE_FONT_PX;
const fontScale = fontSize / BASE_FONT_PX;
const spreadPx = Math.min(
children.length * safeSpread * fontScale,
MAX_SPREAD_PX * fontScale
);
const layerWidth = Math.max(1, textWidth + spreadPx * 2);
const start = -spreadPx - layerWidth / 2;
const end = textWidth + spreadPx - layerWidth / 2;
el.style.setProperty("--gs-spread", spreadPx + "px");
el.style.setProperty("--gs-spread-mid", spreadPx * SPREAD_MID_RATIO + "px");
el.style.backgroundSize = layerWidth + "px 100%";
return { start: start, end: end, durationMs: safeDuration * 1000 };
};
measure();
let anim = null;
let pauseTimer;
let active = true;
let cancelled = false;
const runSweep = () => {
if (cancelled) return;
const m = measure();
const next = el.animate(
[
{ backgroundPosition: m.start + "px center" },
{ backgroundPosition: m.end + "px center" },
],
{ duration: m.durationMs, easing: easingValue, fill: "forwards" }
);
if (!active) next.pause();
if (anim) anim.cancel();
anim = next;
next.onfinish = () => {
pauseTimer = setTimeout(runSweep, Math.max(0, opts.pauseBetween));
};
};
const stopVisibility = observeShimmerActive(el, (next) => {
active = next;
if (anim) {
if (active) anim.play();
else anim.pause();
}
});
runSweep();
window.addEventListener("resize", measure);
return () => {
cancelled = true;
if (anim) anim.cancel();
clearTimeout(pauseTimer);
stopVisibility();
window.removeEventListener("resize", measure);
};
}
document.querySelectorAll("#intro [data-shimmer]").forEach(function (el) {
el.dataset.shimmerReady = "1";
initGradientShimmer(el, {
gradient: sunrise,
easing: "smooth",
duration: 1.45,
spread: 3,
angle: 105,
pauseBetween: 1000,
baseColor: "#c9d6cb",
});
});
function initLiquidMetal(host) {
const canvas = document.createElement("canvas");
host.appendChild(canvas);
const gl = canvas.getContext("webgl", { antialias: true, alpha: false, premultipliedAlpha: false });
if (!gl) {
host.style.background =
"linear-gradient(120deg,#1a1a1a 0%,#8d8d92 28%,#f4f4f6 50%,#6e6e72 72%,#111 100%)";
return { setSpeed: function () {} };
}
const vs = "attribute vec2 a; void main(){ gl_Position = vec4(a,0.0,1.0); }";
const fs = [
"precision highp float;",
"uniform vec2 u_res;",
"uniform float u_time;",
"uniform float u_speed;",
"float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }",
"float noise(vec2 p){",
" vec2 i = floor(p); vec2 f = fract(p);",
" float a = hash(i);",
" float b = hash(i + vec2(1.0,0.0));",
" float c = hash(i + vec2(0.0,1.0));",
" float d = hash(i + vec2(1.0,1.0));",
" vec2 u = f*f*(3.0-2.0*f);",
" return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;",
"}",
"float stripe(float p, float blur){",
" float w1 = 0.12; float w2 = 0.07;",
" float c = mix(0.12, 0.98, smoothstep(0.0, 2.0*blur, p));",
" c = mix(c, 0.12, smoothstep(w1, w1 + 2.0*blur, p));",
" c = mix(c, 0.98, smoothstep(w1+0.35*w2, w1+0.35*w2 + 2.0*blur, p));",
" c = mix(c, 0.12, smoothstep(w1+0.5*w2, w1+0.5*w2 + 2.0*blur, p));",
" float border = w1 + w2;",
" c = mix(c, 0.98, smoothstep(border, border + 2.0*blur, p));",
" float g = mix(0.98, 0.12, smoothstep(0.0, 1.0, (p - border) / max(0.001, 1.0 - border)));",
" c = mix(c, g, smoothstep(border, border + 0.5*blur, p));",
" return c;",
"}",
"void main(){",
" vec2 uv = gl_FragCoord.xy / u_res;",
" float t = 0.3 * (u_time * u_speed + 2.8);",
" float ang = (-45.0 + 70.0) * 3.14159265 / 180.0;",
" vec2 ruv = uv - 0.5;",
" ruv = vec2(ruv.x*cos(ang)-ruv.y*sin(ang), ruv.x*sin(ang)+ruv.y*cos(ang)) + 0.5;",
" float diagBL = ruv.x - ruv.y;",
" float diagTL = ruv.x + ruv.y;",
" vec2 guv = uv - 0.5;",
" float dist = length(guv + vec2(0.0, 0.2 * diagBL));",
" float bump = 1.0 - pow(1.8 * dist, 1.2);",
" bump *= pow(uv.y, 0.3);",
" bump *= clamp(pow(uv.y, 0.1), 0.3, 1.0);",
" float n = noise(uv * 3.5 - t);",
" float direction = guv.x;",
" direction += diagBL;",
" direction *= (0.1 + 1.1 * bump);",
" direction *= (0.5 + 0.5 * pow(uv.y, 2.0));",
" direction *= 4.0;",
" direction -= t;",
" float disp = clamp(1.0 - bump, 0.0, 1.0);",
" float dR = disp * (0.3 / 20.0);",
" float dB = disp * 1.3 * (0.3 / 20.0);",
" float blur = 0.5 / 15.0;",
" float r = stripe(fract(direction + dR), blur);",
" float g = stripe(fract(direction), blur);",
" float b = stripe(fract(direction - dB), blur);",
" vec3 col = vec3(r, g, b);",
" col.b *= 0.96 + 0.08 * smoothstep(0.7, 1.3, diagTL);",
" gl_FragColor = vec4(col, 1.0);",
"}"
].join("\\n");
function compile(type, src) {
const s = gl.createShader(type);
gl.shaderSource(s, src);
gl.compileShader(s);
return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog);
gl.useProgram(prog);
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, "a");
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const uRes = gl.getUniformLocation(prog, "u_res");
const uTime = gl.getUniformLocation(prog, "u_time");
const uSpeed = gl.getUniformLocation(prog, "u_speed");
let speed = 0.6;
let running = true;
const start = performance.now();
function resize() {
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const w = Math.floor(host.clientWidth * dpr) || 284;
const h = Math.floor(host.clientHeight * dpr) || 92;
if (canvas.width !== w || canvas.height !== h) {
canvas.width = Math.max(w, 2);
canvas.height = Math.max(h, 2);
gl.viewport(0, 0, canvas.width, canvas.height);
}
}
function frame(now) {
if (!running) return;
resize();
gl.uniform2f(uRes, canvas.width, canvas.height);
gl.uniform1f(uTime, (now - start) / 1000);
gl.uniform1f(uSpeed, speed);
gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
return {
setSpeed: function (v) { speed = v; },
stop: function () { running = false; }
};
}
function paperUniforms() {
return {
u_repetition: 4,
u_softness: 0.5,
u_shiftRed: 0.3,
u_shiftBlue: 0.3,
u_distortion: 0,
u_contour: 0,
u_angle: 45,
u_scale: 8,
u_shape: 1,
u_offsetX: 0.1,
u_offsetY: -0.1,
u_rotation: 0,
u_originX: 0.5,
u_originY: 0.5,
u_worldWidth: 0,
u_worldHeight: 0,
u_fit: 1,
u_colorBack: [0, 0, 0, 0],
u_colorTint: [1, 1, 1, 1],
u_isImage: false,
u_image: undefined
};
}
async function mountPaperShader(host) {
const mod = await import("https://esm.sh/@paper-design/shaders@0.0.80");
return new mod.ShaderMount(
host,
mod.liquidMetalFragmentShader,
paperUniforms(),
undefined,
0.6
);
}
function wireLiquidButton(btn) {
const wrap = btn.closest(".lm-root");
const host = wrap && wrap.querySelector("[data-liquid]");
if (!wrap || !host) return;
let shader = null;
mountPaperShader(host)
.then(function (mount) {
shader = mount;
})
.catch(function () {
shader = initLiquidMetal(host);
});
wrap.addEventListener("pointerenter", function () {
wrap.classList.add("is-hover");
shader && shader.setSpeed && shader.setSpeed(1);
});
wrap.addEventListener("pointerleave", function () {
wrap.classList.remove("is-hover");
wrap.classList.remove("is-pressed");
shader && shader.setSpeed && shader.setSpeed(0.6);
});
btn.addEventListener("pointerdown", function () {
wrap.classList.add("is-pressed");
});
btn.addEventListener("pointerup", function (e) {
wrap.classList.remove("is-pressed");
if (shader && shader.setSpeed) {
shader.setSpeed(2.4);
setTimeout(function () {
shader.setSpeed(wrap.classList.contains("is-hover") ? 1 : 0.6);
}, 300);
}
const rect = btn.getBoundingClientRect();
const span = document.createElement("span");
span.className = "lm-ripple";
span.style.left = (e.clientX - rect.left) + "px";
span.style.top = (e.clientY - rect.top) + "px";
btn.appendChild(span);
setTimeout(function () { span.remove(); }, 600);
});
btn.addEventListener("pointercancel", function () {
wrap.classList.remove("is-pressed");
});
}
window.openArmoxSubscription = function(){
var g = document.getElementById("onboardGate");
if (g) { g.classList.remove("done"); g.style.display = "flex"; }
showScreen("subscription");
};
window.closeArmoxOnboard = function(){
var g = document.getElementById("onboardGate");
if (g) { g.classList.add("done"); g.style.display = "none"; }
};
function showScreen(id) {
document.querySelectorAll(".screen").forEach(function (el) {
el.classList.remove("is-active");
});
const next = document.getElementById(id);
if (!next) return;
next.classList.add("is-active");
next.querySelectorAll("[data-shimmer]").forEach(function (el) {
if (!el.dataset.shimmerReady) {
el.dataset.shimmerReady = "1";
const characterStyle = el.dataset.shimmer === "character";
initGradientShimmer(el, {
gradient: characterStyle ? characterInk : sunrise,
easing: "smooth",
duration: 1.45,
spread: 3,
angle: 105,
pauseBetween: 1000,
baseColor: characterStyle ? "#173e69" : "#c9d6cb",
});
}
});
}
const startBtn = document.getElementById("start-btn");
function pressOn() {
startBtn.classList.add("is-pressed");
}
function pressOff() {
startBtn.classList.remove("is-pressed");
}
startBtn.addEventListener("pointerdown", pressOn);
startBtn.addEventListener("pointerup", pressOff);
startBtn.addEventListener("pointercancel", pressOff);
startBtn.addEventListener("pointerleave", pressOff);
startBtn.addEventListener("lostpointercapture", pressOff);
startBtn.addEventListener("click", function () {
startBtn.classList.remove("is-clicked");
void startBtn.offsetWidth;
startBtn.classList.add("is-clicked");
setTimeout(function () {
showScreen("name");
const nameInput = document.getElementById("username-input");
if (nameInput) {
setTimeout(function () { nameInput.focus(); }, 80);
}
const b2 = document.getElementById("btn-2");
if (b2 && !b2.dataset.wired) {
b2.dataset.wired = "1";
wireLiquidButton(b2);
}
}, 420);
});
const nameInput = document.getElementById("username-input");
const nameField = document.querySelector(".name-field");
const usernameError = document.getElementById("username-error");
const continueNameBtn = document.getElementById("btn-2");
const continueCharacterBtn = document.getElementById("btn-3");
const characterScreen = document.getElementById("character");
const characterPreview = document.getElementById("character-preview");
const characterChoices = Array.from(document.querySelectorAll(".character-choice"));
const characters = {
man: {
src: "images/avatars/758539740_armox-man.png",
alt: "شخصیت مرد آرموکس"
},
woman: {
src: "images/avatars/758539800_armox-woman.png",
alt: "شخصیت زن آرموکس"
}
};
function selectCharacter(type) {
const selected = characters[type];
if (!selected) return;
characterScreen.classList.toggle("is-man", type === "man");
characterScreen.classList.toggle("is-woman", type === "woman");
characterScreen.dataset.selectedCharacter = type;
characterChoices.forEach(function (choice) {
const active = choice.dataset.character === type;
choice.classList.toggle("is-selected", active);
choice.setAttribute("aria-checked", active ? "true" : "false");
choice.tabIndex = active ? 0 : -1;
});
if (characterPreview.getAttribute("src") !== selected.src) {
characterPreview.classList.remove("is-changing");
characterPreview.src = selected.src;
characterPreview.alt = selected.alt;
void characterPreview.offsetWidth;
characterPreview.classList.add("is-changing");
}
}
characterChoices.forEach(function (choice, index) {
choice.addEventListener("click", function () {
selectCharacter(choice.dataset.character);
});
choice.addEventListener("keydown", function (event) {
if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
event.preventDefault();
const direction = event.key === "ArrowRight" ? 1 : -1;
const nextIndex = (index + direction + characterChoices.length) % characterChoices.length;
characterChoices[nextIndex].focus();
selectCharacter(characterChoices[nextIndex].dataset.character);
});
});
const usernameStorageKey = "armox-used-usernames";
const usernameResetMarker = "armox-usernames-reset-v6";
try {
if (localStorage.getItem(usernameResetMarker) !== "done") {
localStorage.removeItem(usernameStorageKey);
localStorage.setItem(usernameResetMarker, "done");
}
} catch (error) {
}
const persianCharacters = /[\u0600-\u06FF]/;
const englishUsername = /^[A-Za-z0-9_]+$/;
function readUsedUsernames() {
try {
const saved = JSON.parse(localStorage.getItem(usernameStorageKey) || "[]");
return Array.isArray(saved) ? saved : [];
} catch (error) {
return [];
}
}
function showUsernameError(message, shake) {
usernameError.textContent = message || "";
usernameError.classList.toggle("is-visible", Boolean(message));
nameInput.setAttribute("aria-invalid", message ? "true" : "false");
nameField.classList.remove("is-invalid");
if (message && shake) {
void nameField.offsetWidth;
nameField.classList.add("is-invalid");
}
}
function reserveUsername(username) {
const normalized = username.toLowerCase();
const used = readUsedUsernames();
if (!used.includes(normalized)) used.push(normalized);
try {
localStorage.setItem(usernameStorageKey, JSON.stringify(used.slice(-250)));
} catch (error) {
}
}
function usernameValidationMessage(username) {
if (!username) return "اول نام کاربری را وارد کنید.";
if (persianCharacters.test(username)) return "نام کاربری فارسی قابل قبول نیست؛ فقط انگلیسی بنویسید.";
if (!englishUsername.test(username)) return "فقط حروف انگلیسی، عدد و خط زیر (_) مجاز است.";
if (readUsedUsernames().includes(username.toLowerCase())) return "این نام کاربری قبلاً انتخاب شده است.";
return "";
}
continueNameBtn.addEventListener("click", function () {
const username = nameInput.value.trim();
const validationMessage = usernameValidationMessage(username);
if (validationMessage) {
showUsernameError(validationMessage, true);
nameInput.focus();
return;
}
showUsernameError("", false);
reserveUsername(username);
nameInput.blur();
try {
const prev = JSON.parse(localStorage.getItem("armox-profile") || "{}");
localStorage.setItem("armox-profile", JSON.stringify(Object.assign({}, prev, { username: username, displayName: prev.displayName || "" })));
} catch (e) {}
showScreen("character");
selectCharacter(characterScreen.dataset.selectedCharacter || "man");
if (continueCharacterBtn && !continueCharacterBtn.dataset.wired) {
continueCharacterBtn.dataset.wired = "1";
wireLiquidButton(continueCharacterBtn);
}
});
nameInput.addEventListener("input", function () {
const value = nameInput.value.trim();
if (persianCharacters.test(value)) {
showUsernameError("نام کاربری فارسی قابل قبول نیست؛ فقط انگلیسی بنویسید.", false);
} else if (value && !englishUsername.test(value)) {
showUsernameError("فقط حروف انگلیسی، عدد و خط زیر (_) مجاز است.", false);
} else if (value && readUsedUsernames().includes(value.toLowerCase())) {
showUsernameError("این نام کاربری قبلاً انتخاب شده است.", false);
} else {
showUsernameError("", false);
}
});
nameInput.addEventListener("keydown", function (event) {
if (event.key === "Enter") {
event.preventDefault();
continueNameBtn.click();
}
});
const ageScreen = document.getElementById("age");
const ageTitle = document.getElementById("age-title");
const ageProfileImage = document.getElementById("age-profile-image");
const ageEntry = document.querySelector(".age-entry");
const ageDigitDisplay = document.getElementById("age-digit-display");
const ageEntryError = document.getElementById("age-entry-error");
const ageKeypad = document.getElementById("age-keypad");
const ageDeleteKey = document.getElementById("age-key-delete");
const ageContinue = document.getElementById("age-continue");
let ageDigits = "";
function hapticTick(pattern) {
if (navigator.vibrate) {
try { navigator.vibrate(pattern || 10); } catch (error) { }
}
}
function showAgeError(message) {
ageEntryError.textContent = message || "";
ageEntryError.classList.toggle("is-visible", Boolean(message));
}
function renderAgeInput() {
const empty = ageDigits.length === 0;
ageDigitDisplay.textContent = empty ? "--" : ageDigits;
ageDigitDisplay.classList.toggle("is-placeholder", empty);
ageScreen.dataset.age = empty ? "" : String(Number(ageDigits));
if (!empty) showAgeError("");
}
function pulseAgeLimit() {
ageEntry.classList.remove("is-full");
void ageEntry.offsetWidth;
ageEntry.classList.add("is-full");
showAgeError("سن بیشتر از دو رقم نمی‌تواند باشد.");
hapticTick([8, 28, 8]);
}
function enterAgeDigit(digit, sourceButton) {
if (ageDigits.length >= 2) {
pulseAgeLimit();
return;
}
if (ageDigits === "0") ageDigits = digit;
else ageDigits += digit;
renderAgeInput();
hapticTick(8);
if (sourceButton) {
sourceButton.classList.remove("is-pressed");
void sourceButton.offsetWidth;
sourceButton.classList.add("is-pressed");
setTimeout(function () { sourceButton.classList.remove("is-pressed"); }, 125);
}
}
function deleteAgeDigit() {
ageDigits = ageDigits.slice(0, -1);
renderAgeInput();
hapticTick(7);
}
ageKeypad.addEventListener("click", function (event) {
const key = event.target.closest("[data-digit]");
if (!key) return;
enterAgeDigit(key.dataset.digit, key);
});
ageDeleteKey.addEventListener("click", deleteAgeDigit);
document.addEventListener("keydown", function (event) {
if (!ageScreen.classList.contains("is-active")) return;
if (/^[0-9]$/.test(event.key)) {
event.preventDefault();
enterAgeDigit(event.key, ageKeypad.querySelector('[data-digit="' + event.key + '"]'));
} else if (event.key === "Backspace" || event.key === "Delete") {
event.preventDefault();
deleteAgeDigit();
} else if (event.key === "Enter") {
event.preventDefault();
ageContinue.click();
}
});
renderAgeInput();
continueCharacterBtn.addEventListener("click", function () {
const type = characterScreen.dataset.selectedCharacter || "man";
const selected = characters[type];
try {
const prev = JSON.parse(localStorage.getItem("armox-profile") || "{}");
if (!prev.photoCustom) {
prev.photo = selected.src;
prev.character = type;
}
localStorage.setItem("armox-profile", JSON.stringify(prev));
} catch (e) {}
ageScreen.classList.toggle("is-man", type === "man");
ageScreen.classList.toggle("is-woman", type === "woman");
ageProfileImage.src = selected.src;
ageTitle.textContent = "سن خودتو وارد کن، " + nameInput.value.trim();
ageDigits = "";
renderAgeInput();
showScreen("age");
setTimeout(function () {
const firstKey = ageKeypad.querySelector('[data-digit="1"]');
firstKey && firstKey.focus({ preventScroll: true });
}, 100);
});
const lifeToggle = document.getElementById("life-toggle");
const lifeChoice = document.getElementById("life-choice");
const lifeNormalLabel = document.getElementById("life-label-normal");
const lifeArmoxLabel = document.getElementById("life-label-armox");
const bucketChipLayer = document.getElementById("bucket-chip-layer");
let lifeTransitionTimer = 0;
let bucketSequenceInterval = 0;
let bucketCleanupTimers = [];
let bucketIndex = 0;
const beliefMessages = [
"حرف های دیگران راسته !",
"نمی‌شه، ولش کن.",
"تو توانش را نداری.",
"الان دیر شده است.",
"بقیه بهتر از توئن.",
"چیزی عوض نمی‌شه.",
"وقت تلف نکن.",
"رویاهای تو بچگانه‌ست.",
"مگه می‌شه؟!"
];
function updateLifeChoice() {
const armoxLife = lifeToggle.checked;
lifeChoice.classList.toggle("is-armox", armoxLife);
lifeNormalLabel.classList.toggle("is-active", !armoxLife);
lifeArmoxLabel.classList.toggle("is-active", armoxLife);
}
function clearBucketSequence() {
clearInterval(bucketSequenceInterval);
bucketSequenceInterval = 0;
bucketCleanupTimers.forEach(function (timer) { clearTimeout(timer); });
bucketCleanupTimers = [];
bucketChipLayer.textContent = "";
}
function showNextBucketChip() {
const current = bucketChipLayer.querySelector(".bucket-chip.is-active");
if (current) {
current.classList.remove("is-active");
current.classList.add("is-exiting");
const cleanup = setTimeout(function () { current.remove(); }, 820);
bucketCleanupTimers.push(cleanup);
}
const card = document.createElement("div");
const text = document.createElement("span");
const messageIndex = bucketIndex % beliefMessages.length;
card.className = "bucket-chip";
text.className = "bucket-chip-text";
text.textContent = beliefMessages[messageIndex];
card.appendChild(text);
bucketChipLayer.appendChild(card);
requestAnimationFrame(function () {
requestAnimationFrame(function () { card.classList.add("is-active"); });
});
bucketIndex = (bucketIndex + 1) % beliefMessages.length;
}
function startBucketSequence() {
clearBucketSequence();
bucketIndex = 0;
showNextBucketChip();
bucketSequenceInterval = setInterval(showNextBucketChip, 2000);
}
ageContinue.addEventListener("click", function () {
if (!ageDigits) {
showAgeError("سن خودت را وارد کن.");
ageEntry.classList.remove("is-full");
void ageEntry.offsetWidth;
ageEntry.classList.add("is-full");
hapticTick([10, 30, 10]);
return;
}
ageScreen.dataset.age = String(Number(ageDigits));
clearTimeout(lifeTransitionTimer);
lifeToggle.disabled = false;
lifeToggle.checked = false;
updateLifeChoice();
showScreen("life-mode");
setTimeout(function () { lifeToggle.focus(); }, 100);
});
lifeToggle.addEventListener("change", function () {
clearTimeout(lifeTransitionTimer);
updateLifeChoice();
if (!lifeToggle.checked) return;
hapticTick(12);
lifeToggle.disabled = true;
lifeTransitionTimer = setTimeout(function () {
showScreen("discard");
startBucketSequence();
}, 500);
});
const discardContinue = document.getElementById("discard-continue");
const questionScreen = document.getElementById("questions");
const questionPage = document.querySelector(".question-page");
const questionBack = document.getElementById("question-back");
const questionProgress = document.getElementById("question-progress");
const questionProgressFill = document.getElementById("question-progress-fill");
const questionTitle = document.getElementById("question-title");
const questionHint = document.getElementById("question-hint");
const questionOptions = document.getElementById("question-options");
const questionNext = document.getElementById("question-next");
const questions = [
{
title: "چه چیزی بیشتر از همه تمرکز شما را از بین می‌برد؟",
options: [
"استرس و فکر زیاد (نشخوار فکری)",
"افت انرژی ناشی از غذای بد",
"مه مغزی (گیجی ذهنی) ناشی از خواب بد",
"سردردهای ناشی از کم‌آبی بدن",
"ناراحتی جسمی",
"فقط احساس خستگی مفرط",
"سایر موارد"
]
},
{
title: "وقتی استرس دارید، معمولاً:",
options: [
"انرژی می‌گیرید و سخت‌تر کار می‌کنید",
"خاموش می‌شوید و از انجام کارها فرار می‌کنید",
"پراکنده و غرق در کار می‌شوید",
"آن را به سمت تمرکز شدید هدایت می‌کنید",
"حالت دفاعی و واکنشی پیدا می‌کنید",
"سایر موارد"
]
},
{
title: "اولویت اصلی شما چیست؟",
options: [
"انرژی طبیعی بی‌پایان",
"تمرکز ذهنی دقیق و تیز (مثل لیزر)",
"انضباط ضد گلوله (انضباط آهنین)",
"عملکرد فیزیکی در اوج",
"سرعت ریکاوری بهینه",
"مصونیت در برابر استرس",
"سایر موارد"
]
},
{
title: "چه چیزی بیشتر از همه به شما انگیزه می‌دهد؟",
options: [
"پول درآوردن بیشتر",
"دستیابی به اهداف بلندپروازانه",
"مورد احترام دیگران قرار گرفتن",
"احساس قدرت و پرانرژی بودن",
"وضوح ذهنی و تیزهوشی",
"قدرت بدنی و سلامتی",
"تسلط بر چالش‌های جدید"
]
},
{
title: "چه چیزی قبلاً جلوی شما را گرفته است؟",
options: [
"من برای مراقبت از خود وقت ندارم",
"نمی‌دانم واقعاً چه چیزی کار می‌کند",
"گزینه‌های سالم گران هستند",
"زندگی اجتماعی حول عادت‌های بد می‌چرخد",
"به راحتی حواسم پرت می‌شود",
"نمی‌توانم به روال‌های روزمره پایبند بمانم",
"جهت‌گیری واضحی ندارم",
"سایر موارد"
]
},
{
title: "چقدر زمان می‌توانید روزانه اختصاص دهید؟",
options: [
"۵ تا ۱۰ دقیقه",
"۱۵ تا ۲۰ دقیقه",
"۳۰ تا ۴۵ دقیقه",
"۶۰ دقیقه و بیشتر"
]
}
];
const questionSelections = questions.map(function () { return new Set(); });
let currentQuestionIndex = 0;
function showQuestionWarning(message) {
questionHint.textContent = message || "می‌توانید حداکثر دو گزینه انتخاب کنید";
questionHint.classList.remove("is-warning");
if (message) {
void questionHint.offsetWidth;
questionHint.classList.add("is-warning");
}
}
function updateQuestionSelectionState() {
const selected = questionSelections[currentQuestionIndex];
questionOptions.querySelectorAll(".question-option").forEach(function (option) {
const optionIndex = Number(option.dataset.optionIndex);
const active = selected.has(optionIndex);
option.classList.toggle("is-selected", active);
option.setAttribute("aria-pressed", active ? "true" : "false");
});
questionNext.disabled = selected.size === 0;
}
function renderQuestion() {
const question = questions[currentQuestionIndex];
const selected = questionSelections[currentQuestionIndex];
questionProgress.textContent = "سؤال " + (currentQuestionIndex + 1).toLocaleString("fa-IR") + " از " + questions.length.toLocaleString("fa-IR");
questionProgressFill.style.width = (((currentQuestionIndex + 1) / questions.length) * 100) + "%";
questionBack.disabled = currentQuestionIndex === 0;
questionBack.classList.toggle("is-hidden", currentQuestionIndex === 0);
questionTitle.textContent = question.title;
questionNext.textContent = currentQuestionIndex === questions.length - 1 ? "ادامه" : "بعدی";
questionOptions.textContent = "";
showQuestionWarning("");
const fragment = document.createDocumentFragment();
question.options.forEach(function (label, optionIndex) {
const option = document.createElement("button");
const check = document.createElement("span");
const text = document.createElement("span");
const active = selected.has(optionIndex);
option.type = "button";
option.className = "question-option" + (active ? " is-selected" : "");
option.dataset.optionIndex = String(optionIndex);
option.setAttribute("aria-pressed", active ? "true" : "false");
option.style.setProperty("--option-index", String(optionIndex));
check.className = "question-option-check";
check.textContent = "✓";
check.setAttribute("aria-hidden", "true");
text.className = "question-option-text";
text.textContent = label;
option.appendChild(check);
option.appendChild(text);
fragment.appendChild(option);
});
questionOptions.appendChild(fragment);
questionOptions.scrollTop = 0;
updateQuestionSelectionState();
questionPage.classList.remove("is-switching");
void questionPage.offsetWidth;
questionPage.classList.add("is-switching");
setTimeout(function () { questionPage.classList.remove("is-switching"); }, 340);
}
questionOptions.addEventListener("click", function (event) {
const option = event.target.closest(".question-option");
if (!option) return;
const optionIndex = Number(option.dataset.optionIndex);
const selected = questionSelections[currentQuestionIndex];
if (selected.has(optionIndex)) {
selected.delete(optionIndex);
showQuestionWarning("");
hapticTick(7);
} else if (selected.size < 2) {
selected.add(optionIndex);
showQuestionWarning("");
hapticTick(9);
} else {
showQuestionWarning("حداکثر دو گزینه می‌توانید انتخاب کنید.");
hapticTick([8, 25, 8]);
return;
}
updateQuestionSelectionState();
});
questionBack.addEventListener("click", function () {
if (currentQuestionIndex === 0) return;
currentQuestionIndex -= 1;
renderQuestion();
hapticTick(7);
});
questionNext.addEventListener("click", function () {
if (questionSelections[currentQuestionIndex].size === 0) {
showQuestionWarning("حداقل یک گزینه را انتخاب کنید.");
hapticTick([8, 25, 8]);
return;
}
if (currentQuestionIndex < questions.length - 1) {
currentQuestionIndex += 1;
renderQuestion();
hapticTick(8);
} else {
questionScreen.dataset.completed = "true";
showScreen("decision");
hapticTick(12);
}
});
discardContinue.addEventListener("click", function () {
clearBucketSequence();
currentQuestionIndex = 0;
questionSelections.forEach(function (selection) { selection.clear(); });
renderQuestion();
showScreen("questions");
});
const decisionContinue = document.getElementById("decision-continue");
const revealPage = document.getElementById("reveal-page");
const revealHoldButton = document.getElementById("reveal-hold-button");
const revealHoldFill = document.getElementById("reveal-hold-fill");
const revealHoldLabel = document.getElementById("reveal-hold-label");
const holdDuration = 1800;
let holdAnimationFrame = 0;
let holdStartedAt = 0;
let isHoldingReveal = false;
let revealCompleted = false;
let revealCompletedAt = 0;
function resetRevealPage() {
cancelAnimationFrame(holdAnimationFrame);
holdAnimationFrame = 0;
holdStartedAt = 0;
isHoldingReveal = false;
revealCompleted = false;
revealCompletedAt = 0;
revealPage.classList.remove("is-revealed");
revealHoldFill.style.width = "0%";
revealHoldLabel.textContent = "نگه دار تا معلوم بشه";
}
function completeReveal() {
isHoldingReveal = false;
revealCompleted = true;
revealCompletedAt = performance.now();
revealHoldFill.style.width = "100%";
revealPage.classList.add("is-revealed");
revealHoldLabel.textContent = "ادامه";
hapticTick([18, 35, 22]);
}
function updateRevealHold(now) {
if (!isHoldingReveal || revealCompleted) return;
const progress = Math.min(1, (now - holdStartedAt) / holdDuration);
revealHoldFill.style.width = (progress * 100) + "%";
if (progress >= 1) {
completeReveal();
return;
}
holdAnimationFrame = requestAnimationFrame(updateRevealHold);
}
function startRevealHold(event) {
if (revealCompleted || isHoldingReveal) return;
if (event) {
event.preventDefault();
if (event.pointerId != null && revealHoldButton.setPointerCapture) {
revealHoldButton.setPointerCapture(event.pointerId);
}
}
isHoldingReveal = true;
holdStartedAt = performance.now();
cancelAnimationFrame(holdAnimationFrame);
holdAnimationFrame = requestAnimationFrame(updateRevealHold);
hapticTick(6);
}
function cancelRevealHold() {
if (!isHoldingReveal || revealCompleted) return;
isHoldingReveal = false;
cancelAnimationFrame(holdAnimationFrame);
holdAnimationFrame = 0;
revealHoldFill.style.width = "0%";
}
revealHoldButton.addEventListener("pointerdown", startRevealHold);
revealHoldButton.addEventListener("pointerup", cancelRevealHold);
revealHoldButton.addEventListener("pointercancel", cancelRevealHold);
revealHoldButton.addEventListener("lostpointercapture", cancelRevealHold);
revealHoldButton.addEventListener("pointermove", function (event) {
if (!isHoldingReveal || revealCompleted) return;
const rect = revealHoldButton.getBoundingClientRect();
const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
if (!inside) cancelRevealHold();
});
revealHoldButton.addEventListener("keydown", function (event) {
if ((event.key === " " || event.key === "Enter") && !event.repeat) {
startRevealHold(event);
}
});
revealHoldButton.addEventListener("keyup", function (event) {
if (event.key === " " || event.key === "Enter") cancelRevealHold();
});
decisionContinue.addEventListener("click", function () {
resetRevealPage();
showScreen("reveal");
hapticTick(9);
});
const analysisScreen = document.getElementById("analysis");
const analysisCanvas = document.getElementById("analysis-wave-canvas");
const analysisContent = document.getElementById("analysis-content");
const fluxLabelStage = document.getElementById("flux-label-stage");
const fluxProgressTrack = document.getElementById("flux-progress-track");
const fluxProgressFill = document.getElementById("flux-progress-fill");
const analysisOverall = document.getElementById("analysis-overall");
const analysisScore = document.getElementById("analysis-score");
const analysisPositive = document.getElementById("analysis-positive");
const analysisNeutral = document.getElementById("analysis-neutral");
const analysisNegative = document.getElementById("analysis-negative");
const analysisPositiveLabel = document.getElementById("analysis-positive-label");
const analysisNeutralLabel = document.getElementById("analysis-neutral-label");
const analysisNegativeLabel = document.getElementById("analysis-negative-label");
let particleWaveState = null;
let analysisLoaderFrame = 0;
let activeFluxPhase = -1;
const fluxPhases = [
{ at: 0, label: "در حال پردازش پاسخ‌های شما..." },
{ at: 25, label: "تنظیمات اولیه بر اساس سلیقه شما..." },
{ at: 50, label: "بارگذاری اطلاعات و تنظیمات شخصی..." },
{ at: 75, label: "آماده‌سازی داشبورد بر اساس اهداف شما..." }
];
function compileWaveShader(gl, type, source) {
const shader = gl.createShader(type);
gl.shaderSource(shader, source);
gl.compileShader(shader);
if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
gl.deleteShader(shader);
return null;
}
return shader;
}
function initParticleWave() {
if (particleWaveState) return;
const gl = analysisCanvas.getContext("webgl", { antialias: true, alpha: false });
if (!gl) return;
const vertexSource = `
attribute vec3 aPosition;
attribute float aScale;
uniform float uTime;
uniform float uAspect;
uniform float uPixelRatio;
void main() {
vec3 p = aPosition;
float s = aScale;
p.y += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
p.x += sin(p.y + uTime) * 0.5;
s += (sin(p.x + uTime) * 0.5) + (cos(p.y + uTime) * 0.1) * 2.0;
vec3 eye = vec3(0.0, 6.0, 5.0);
vec3 zAxis = normalize(eye);
vec3 xAxis = vec3(1.0, 0.0, 0.0);
vec3 yAxis = cross(zAxis, xAxis);
vec3 delta = p - eye;
vec3 view = vec3(dot(delta, xAxis), dot(delta, yAxis), dot(delta, zAxis));
float depth = -view.z;
if (depth <= 0.1) {
gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
gl_PointSize = 0.0;
return;
}
float focal = 1.3032254;
gl_Position = vec4((view.x * focal) / (uAspect * depth), (view.y * focal) / depth, 0.0, 1.0);
gl_PointSize = max(1.0, s * 15.0 * uPixelRatio / depth);
}
`;
const fragmentSource = `
precision mediump float;
void main() {
gl_FragColor = vec4(1.0, 1.0, 1.0, 0.5);
}
`;
const vertex = compileWaveShader(gl, gl.VERTEX_SHADER, vertexSource);
const fragment = compileWaveShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
if (!vertex || !fragment) return;
const program = gl.createProgram();
gl.attachShader(program, vertex);
gl.attachShader(program, fragment);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
gl.useProgram(program);
const gap = 0.3;
const amountX = 200;
const amountY = 200;
const count = amountX * amountY;
const positions = new Float32Array(count * 3);
const scales = new Float32Array(count);
let positionIndex = 0;
let scaleIndex = 0;
for (let ix = 0; ix < amountX; ix += 1) {
for (let iy = 0; iy < amountY; iy += 1) {
positions[positionIndex] = ix * gap - (amountX * gap) / 2;
positions[positionIndex + 1] = 0;
positions[positionIndex + 2] = iy * gap - (amountX * gap) / 2;
scales[scaleIndex] = 1;
positionIndex += 3;
scaleIndex += 1;
}
}
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
const aPosition = gl.getAttribLocation(program, "aPosition");
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
const scaleBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, scaleBuffer);
gl.bufferData(gl.ARRAY_BUFFER, scales, gl.STATIC_DRAW);
const aScale = gl.getAttribLocation(program, "aScale");
gl.enableVertexAttribArray(aScale);
gl.vertexAttribPointer(aScale, 1, gl.FLOAT, false, 0, 0);
const uTime = gl.getUniformLocation(program, "uTime");
const uAspect = gl.getUniformLocation(program, "uAspect");
const uPixelRatio = gl.getUniformLocation(program, "uPixelRatio");
gl.clearColor(0, 0, 0, 1);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
particleWaveState = {
gl: gl,
count: count,
uTime: uTime,
uAspect: uAspect,
uPixelRatio: uPixelRatio,
time: 0,
frame: 0
};
function resizeParticleWave() {
if (!particleWaveState) return;
const rect = analysisCanvas.getBoundingClientRect();
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const width = Math.max(1, Math.round(rect.width * dpr));
const height = Math.max(1, Math.round(rect.height * dpr));
if (analysisCanvas.width !== width || analysisCanvas.height !== height) {
analysisCanvas.width = width;
analysisCanvas.height = height;
}
gl.viewport(0, 0, width, height);
gl.uniform1f(uAspect, rect.width / Math.max(1, rect.height));
gl.uniform1f(uPixelRatio, dpr);
}
function drawParticleWave() {
if (!particleWaveState) return;
resizeParticleWave();
particleWaveState.time += 0.05;
gl.uniform1f(uTime, particleWaveState.time);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.drawArrays(gl.POINTS, 0, count);
particleWaveState.frame = requestAnimationFrame(drawParticleWave);
}
window.addEventListener("resize", resizeParticleWave);
drawParticleWave();
}
function setFluxPhase(phaseIndex) {
if (phaseIndex === activeFluxPhase) return;
activeFluxPhase = phaseIndex;
const label = fluxPhases[phaseIndex].label;
const previous = fluxLabelStage.querySelector(".flux-label-text");
function mountLabel() {
const element = document.createElement("div");
element.className = "flux-label-text";
label.split(/(\s+)/).forEach(function (word, index) {
const span = document.createElement("span");
span.textContent = word;
span.style.setProperty("--letter-index", String(index));
element.appendChild(span);
});
fluxLabelStage.appendChild(element);
}
if (previous) {
previous.classList.add("is-exiting");
setTimeout(function () {
previous.remove();
mountLabel();
}, 360);
} else {
mountLabel();
}
}
function calculateReadinessScore() {
const weights = [
[-6, -4, -5, -3, -4, -6, 0],
[6, -8, -6, 7, -5, 0],
[4, 5, 5, 5, 4, 5, 2],
[6, 7, 4, 6, 6, 5, 7],
[-6, -5, -4, -5, -6, -7, -8, -3],
[2, 5, 8, 11]
];
let score = 70;
questionSelections.forEach(function (selection, questionIndex) {
if (!selection.size) return;
let sum = 0;
selection.forEach(function (optionIndex) {
sum += weights[questionIndex][optionIndex] || 0;
});
score += sum / selection.size;
});
return Math.max(35, Math.min(95, Math.round(score)));
}
function showAnalysisResult() {
const score = calculateReadinessScore();
const negative = Math.max(5, Math.round((100 - score) * 0.55));
const neutral = Math.max(0, 100 - score - negative);
let overall = "نیاز به بازسازی پایه";
if (score >= 80) overall = "آمادگی بسیار بالا";
else if (score >= 65) overall = "آمادگی بالا";
else if (score >= 50) overall = "آمادگی متوسط";
analysisOverall.textContent = overall;
analysisPositiveLabel.textContent = score.toLocaleString("fa-IR") + "٪";
analysisNeutralLabel.textContent = neutral.toLocaleString("fa-IR") + "٪";
analysisNegativeLabel.textContent = negative.toLocaleString("fa-IR") + "٪";
analysisPositive.style.width = "0%";
analysisNeutral.style.width = "0%";
analysisNegative.style.width = "0%";
analysisScore.textContent = "۰";
analysisContent.classList.add("is-result");
requestAnimationFrame(function () {
requestAnimationFrame(function () {
analysisPositive.style.width = score + "%";
analysisNeutral.style.width = neutral + "%";
analysisNegative.style.width = negative + "%";
});
});
const scoreStartedAt = performance.now();
function animateScore(now) {
const progress = Math.min(1, (now - scoreStartedAt) / 850);
const eased = 1 - Math.pow(1 - progress, 3);
analysisScore.textContent = Math.round(score * eased).toLocaleString("fa-IR");
if (progress < 1) requestAnimationFrame(animateScore);
}
requestAnimationFrame(animateScore);
hapticTick([16, 30, 18]);
}
function startAnalysisLoader() {
cancelAnimationFrame(analysisLoaderFrame);
analysisContent.classList.remove("is-result");
fluxProgressFill.style.width = "0%";
fluxProgressTrack.setAttribute("aria-valuenow", "0");
fluxLabelStage.textContent = "";
activeFluxPhase = -1;
setFluxPhase(0);
initParticleWave();
const startedAt = performance.now();
function updateLoader(now) {
const progress = Math.min(100, ((now - startedAt) / 10000) * 100);
fluxProgressFill.style.width = progress + "%";
fluxProgressTrack.setAttribute("aria-valuenow", String(Math.round(progress)));
let nextPhase = 0;
for (let index = 0; index < fluxPhases.length; index += 1) {
if (progress >= fluxPhases[index].at) nextPhase = index;
}
setFluxPhase(nextPhase);
if (progress >= 100) {
showAnalysisResult();
return;
}
analysisLoaderFrame = requestAnimationFrame(updateLoader);
}
analysisLoaderFrame = requestAnimationFrame(updateLoader);
}
revealHoldButton.addEventListener("click", function () {
if (!revealCompleted) return;
if (performance.now() - revealCompletedAt < 550) return;
showScreen("analysis");
startAnalysisLoader();
});
const analysisContinue = document.getElementById("analysis-continue");
const subscriptionScreen = document.getElementById("subscription");
const subscriptionPage = document.querySelector(".subscription-page");
const subscriptionUserId = document.getElementById("subscription-user-id");
const subscriptionContinue = document.getElementById("subscription-continue");
const subscriptionPlans = Array.from(document.querySelectorAll(".subscription-plan"));
function selectSubscriptionPlan(planName) {
subscriptionPlans.forEach(function (plan) {
const active = plan.dataset.plan === planName;
plan.classList.toggle("is-selected", active);
plan.setAttribute("aria-checked", active ? "true" : "false");
});
subscriptionScreen.dataset.selectedPlan = planName;
}
subscriptionPlans.forEach(function (plan) {
plan.addEventListener("click", function () {
selectSubscriptionPlan(plan.dataset.plan);
hapticTick(9);
if (plan.dataset.plan === "trial") {
setTimeout(openSignupPage, 220);
}
});
});
let subscriptionOpening = false;
function openSubscriptionPage(event) {
if (event) event.preventDefault();
if (subscriptionOpening) return;
subscriptionOpening = true;
const username = nameInput.value.trim() || "user";
subscriptionUserId.textContent = "@" + username;
selectSubscriptionPlan("trial");
showScreen("subscription");
subscriptionPage.scrollTop = 0;
hapticTick(10);
requestAnimationFrame(function () {
subscriptionPage.scrollTop = 0;
subscriptionOpening = false;
});
}
analysisContinue.addEventListener("pointerup", openSubscriptionPage);
analysisContinue.addEventListener("click", openSubscriptionPage);
const signupScreen = document.getElementById("signup");
const signupCanvas = document.getElementById("signup-plasma-canvas");
const signupForm = document.getElementById("signup-form");
const signupEmail = document.getElementById("signup-email");
const signupPassword = document.getElementById("signup-password");
const signupMessage = document.getElementById("signup-message");
const signupGoogle = document.getElementById("signup-google");
let signupPlasmaState = null;
const signupPlasmaFragment = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec3 u_colors[8];
uniform vec4 u_scene;
uniform vec4 u_shape;
uniform vec4 u_surface;
uniform vec4 u_finish;
uniform vec4 u_transform;
uniform vec4 u_space;
uniform vec4 u_cursor;
#define u_resolution u_scene.xy
#define u_time u_scene.z
#define u_colorCount u_scene.w
#define u_scale u_shape.x
#define u_intensity u_shape.y
#define u_paramA u_shape.z
#define u_warp u_shape.w
#define u_detail u_surface.x
#define u_contrast u_surface.y
#define u_brightness u_surface.z
#define u_saturation u_surface.w
#define u_hue u_finish.x
#define u_vignette u_finish.y
#define u_blur u_finish.z
#define u_grain u_finish.w
#ifdef GL_FRAGMENT_PRECISION_HIGH
#define u_seed u_transform.x
#else
#define u_seed mod(u_transform.x, 31.0)
#endif
#define u_rotate u_transform.y
#define u_drift u_transform.z
#define u_oklab u_transform.w
#define u_offset u_space.xy
#define u_mouse u_space.zw
#define u_cursorPresence u_cursor.x
#define u_cursorEffect u_cursor.y
#define u_cursorStrength u_cursor.z
#define u_cursorRadius u_cursor.w
float hash21(vec2 p) {
#ifndef GL_FRAGMENT_PRECISION_HIGH
p = mod(p, 31.0);
#endif
p = fract(p * vec2(234.34, 435.345));
p += dot(p, p + 34.23);
return fract(p.x * p.y);
}
float grainHash(vec2 p) {
vec3 p3 = fract(vec3(p.xyx) * 0.1031);
p3 += dot(p3, p3.yzx + 33.33);
return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
#ifndef GL_FRAGMENT_PRECISION_HIGH
p = mod(p, 31.0);
#endif
float n = sin(dot(p, vec2(41.0, 289.0)));
return fract(vec2(15731.743, 7892.321) * n);
}
float noise(vec2 p) {
vec2 i = floor(p);
vec2 f = fract(p);
vec2 u = f * f * (3.0 - 2.0 * f);
return mix(
mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
u.y);
}
float fbm(vec2 p) {
float v = 0.0;
float a = 0.5;
for (int i = 0; i < 5; i++) {
v += a * noise(p);
p = p * 2.03 + vec2(17.0, 9.2);
a *= 0.5;
}
return v;
}
vec3 srgbToLinear(vec3 c) {
return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)),
step(0.04045, c));
}
vec3 linearToSrgb(vec3 c) {
return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055,
step(0.0031308, c));
}
vec3 linToOklab(vec3 c) {
float l = 0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b;
float m = 0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b;
float s = 0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b;
l = pow(max(l, 0.0), 1.0 / 3.0);
m = pow(max(m, 0.0), 1.0 / 3.0);
s = pow(max(s, 0.0), 1.0 / 3.0);
return vec3(
0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
0.0259040371 * l + 0.7827712162 * m - 0.8086757660 * s);
}
vec3 oklabToLin(vec3 c) {
float l = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
float m = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
float s = c.x - 0.0894841775 * c.y - 1.2914855480 * c.z;
l = l * l * l; m = m * m * m; s = s * s * s;
return vec3(
4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s);
}
vec3 mixColour(vec3 a, vec3 b, float t) {
if (u_oklab > 0.5) {
vec3 la = linToOklab(srgbToLinear(a));
vec3 lb = linToOklab(srgbToLinear(b));
return clamp(linearToSrgb(oklabToLin(mix(la, lb, t))), 0.0, 1.0);
}
return mix(a, b, t);
}
vec3 palette(float x) {
float n = max(u_colorCount - 1.0, 1.0);
float f = clamp(x, 0.0, 1.0) * n;
vec3 col = u_colors[0];
for (int i = 0; i < 7; i++) {
if (float(i) < n)
col = mixColour(col, u_colors[i + 1],
smoothstep(0.0, 1.0, clamp(f - float(i), 0.0, 1.0)));
}
return col;
}
vec3 hueRotate(vec3 col, float a) {
const mat3 toYIQ = mat3(0.299, 0.596, 0.211,
0.587, -0.274, -0.523,
0.114, -0.322, 0.312);
const mat3 toRGB = mat3(1.0, 1.0, 1.0,
0.956, -0.272, -1.106,
0.621, -0.647, 1.703);
vec3 yiq = toYIQ * col;
float ca = cos(a), sa = sin(a);
yiq = vec3(yiq.x, yiq.y * ca - yiq.z * sa, yiq.y * sa + yiq.z * ca);
return toRGB * yiq;
}
vec3 shade(vec2 uv, vec2 p, float t) {
float k = 2.0 + u_intensity * 6.0;
float v = sin(p.x * k + t) + sin(p.y * k * 0.8 - t * 0.7)
+ sin((p.x + p.y) * k * 0.6 + t * 0.5)
+ sin(length(p) * k * 1.2 - t);
return palette(0.5 + 0.5 * sin(v + u_seed));
}
void main() {
vec2 uv = gl_FragCoord.xy / u_resolution.xy;
vec2 screenUv = uv;
vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy)
/ min(u_resolution.x, u_resolution.y);
float cursorMask = 0.0;
if (u_cursorPresence > 0.001) {
vec2 cursor = (0.5 * u_mouse * u_resolution.xy)
/ min(u_resolution.x, u_resolution.y);
vec2 cursorDelta = p - cursor;
if (u_cursorEffect < 0.5) {
p += cursor * u_cursorPresence * u_cursorStrength * 0.55;
} else {
float cursorDistance = length(cursorDelta);
vec2 cursorDirection = cursorDelta / max(cursorDistance, 0.0001);
cursorMask = u_cursorPresence
* (1.0 - smoothstep(0.0, u_cursorRadius, cursorDistance));
if (u_cursorEffect < 1.5) {
p -= cursorDirection * cursorMask * u_cursorStrength * 0.24;
} else if (u_cursorEffect < 2.5) {
float cursorAngle = cursorMask * u_cursorStrength * 2.2;
float cc = cos(cursorAngle), cs = sin(cursorAngle);
p = cursor + mat2(cc, -cs, cs, cc) * cursorDelta;
} else if (u_cursorEffect < 3.5) {
float ripple = sin(
cursorDistance / max(u_cursorRadius, 0.001) * 18.0 - u_time * 5.0);
p -= cursorDirection * ripple * cursorMask * u_cursorStrength * 0.07;
}
}
}
uv = p * min(u_resolution.x, u_resolution.y) / u_resolution.xy + 0.5;
p *= u_scale;
if (abs(u_rotate) > 0.0001) {
float cr = cos(u_rotate), sr = sin(u_rotate);
p = mat2(cr, -sr, sr, cr) * p;
}
p += u_offset;
if (u_drift > 0.0001)
p += u_drift * vec2(sin(u_time * 0.31), cos(u_time * 0.23));
if (u_warp > 0.0) {
p += u_warp * (vec2(
fbm(p * u_detail + u_seed),
fbm(p * u_detail + vec2(5.2, 1.3))) - 0.5);
}
vec3 col;
if (u_blur > 0.0) {
float e = u_blur;
float pe = e * u_scale;
vec2 uvE = vec2(e) * min(u_resolution.x, u_resolution.y) / u_resolution.xy;
col = shade(uv, p, u_time) * 0.36;
col += shade(uv + vec2(uvE.x, 0.0), p + vec2(pe, 0.0), u_time) * 0.16;
col += shade(uv - vec2(uvE.x, 0.0), p - vec2(pe, 0.0), u_time) * 0.16;
col += shade(uv + vec2(0.0, uvE.y), p + vec2(0.0, pe), u_time) * 0.16;
col += shade(uv - vec2(0.0, uvE.y), p - vec2(0.0, pe), u_time) * 0.16;
} else {
col = shade(uv, p, u_time);
}
if (abs(u_contrast - 1.0) > 0.0001)
col = (col - 0.5) * u_contrast + 0.5;
if (abs(u_saturation - 1.0) > 0.0001) {
float luma = dot(col, vec3(0.299, 0.587, 0.114));
col = mix(vec3(luma), col, u_saturation);
}
if (abs(u_hue) > 0.0001)
col = hueRotate(col, u_hue);
if (abs(u_brightness) > 0.0001)
col += u_brightness;
if (u_vignette > 0.0001) {
float vd = length(screenUv - 0.5) * 1.41421356;
col *= 1.0 - u_vignette * smoothstep(0.35, 1.0, vd);
}
if (u_cursorPresence > 0.001 && u_cursorEffect > 3.5)
col += (vec3(0.18) + col * 0.12) * cursorMask * u_cursorStrength;
if (u_grain > 0.0001)
col += (grainHash(
gl_FragCoord.xy + vec2(u_seed * 17.0, u_seed * 31.0)) - 0.5) * u_grain;
gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;
function initSignupPlasma() {
if (signupPlasmaState) return;
const gl = signupCanvas.getContext("webgl", { antialias: true, alpha: false });
if (!gl) return;
const vertexSource = `
attribute vec2 a_position;
void main() {
gl_Position = vec4(a_position, 0.0, 1.0);
}
`;
const vertex = compileWaveShader(gl, gl.VERTEX_SHADER, vertexSource);
const fragment = compileWaveShader(gl, gl.FRAGMENT_SHADER, signupPlasmaFragment);
if (!vertex || !fragment) return;
const program = gl.createProgram();
gl.attachShader(program, vertex);
gl.attachShader(program, fragment);
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
gl.useProgram(program);
const triangle = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, triangle);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const position = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(position);
gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
const uniforms = {
colors: gl.getUniformLocation(program, "u_colors[0]"),
scene: gl.getUniformLocation(program, "u_scene"),
shape: gl.getUniformLocation(program, "u_shape"),
surface: gl.getUniformLocation(program, "u_surface"),
finish: gl.getUniformLocation(program, "u_finish"),
transform: gl.getUniformLocation(program, "u_transform"),
space: gl.getUniformLocation(program, "u_space"),
cursor: gl.getUniformLocation(program, "u_cursor")
};
gl.uniform3fv(uniforms.colors, new Float32Array([
0.086, 0.043, 0.043,
0.761, 0.251, 0.165,
0.957, 0.616, 0.216,
1.000, 0.910, 0.761,
1.000, 0.910, 0.761,
1.000, 0.910, 0.761,
1.000, 0.910, 0.761,
1.000, 0.910, 0.761
]));
gl.uniform4f(uniforms.shape, 1.50, 0.48, 0.50, 0.00);
gl.uniform4f(uniforms.surface, 2.40, 0.92, -0.50, 1.00);
gl.uniform4f(uniforms.finish, 3.04, 0.61, 0.016, 0.35);
gl.uniform4f(uniforms.transform, 7.0, 0.00, 0.16, 0.0);
gl.uniform4f(uniforms.space, 0.00, 0.00, 0.00, 0.00);
gl.uniform4f(uniforms.cursor, 0.00, 4.0, 0.65, 0.30);
gl.clearColor(0.086, 0.043, 0.043, 1);
signupPlasmaState = {
gl: gl,
uniforms: uniforms,
elapsed: 0,
last: 0,
frame: 0
};
function resize() {
const rect = signupCanvas.getBoundingClientRect();
const dpr = Math.min(window.devicePixelRatio || 1, 2);
const width = Math.max(1, Math.round(rect.width * dpr));
const height = Math.max(1, Math.round(rect.height * dpr));
if (signupCanvas.width !== width || signupCanvas.height !== height) {
signupCanvas.width = width;
signupCanvas.height = height;
}
gl.viewport(0, 0, width, height);
}
function draw(now) {
signupPlasmaState.frame = 0;
if (document.hidden) return;
resize();
if (!signupPlasmaState.last) signupPlasmaState.last = now;
const delta = Math.min(0.1, (now - signupPlasmaState.last) / 1000);
signupPlasmaState.last = now;
signupPlasmaState.elapsed += delta;
gl.uniform4f(
uniforms.scene,
signupCanvas.width,
signupCanvas.height,
signupPlasmaState.elapsed * 0.86,
4.0
);
gl.drawArrays(gl.TRIANGLES, 0, 3);
signupPlasmaState.frame = requestAnimationFrame(draw);
}
window.addEventListener("resize", resize);
document.addEventListener("visibilitychange", function () {
if (!document.hidden && signupPlasmaState && !signupPlasmaState.frame) {
signupPlasmaState.last = performance.now();
signupPlasmaState.frame = requestAnimationFrame(draw);
}
});
signupPlasmaState.frame = requestAnimationFrame(draw);
}
function showSignupMessage(message, success) {
signupMessage.textContent = message || "";
signupMessage.classList.toggle("is-success", Boolean(success));
}
function setSignupMode(mode) {
const page = document.querySelector(".signup-page");
const login = mode === "login";
if (page) page.classList.toggle("is-login", login);
const title = document.querySelector(".signup-title");
if (title) title.textContent = login ? "ورود" : "خوش آمدی";
const submit = document.querySelector(".signup-submit");
if (submit) submit.textContent = login ? "ورود" : "ثبت‌نام";
const gReg = document.querySelector("#signup-google .reg-only");
const gLog = document.querySelector("#signup-google .login-only");
if (gReg) gReg.style.display = login ? "none" : "";
if (gLog) gLog.style.display = login ? "" : "none";
const toLogin = document.getElementById("switchToLogin");
const toReg = document.getElementById("switchToRegister");
if (toLogin) toLogin.hidden = login;
if (toReg) toReg.hidden = !login;
}
function openSignupPage(mode) {
setSignupMode(mode === "login" ? "login" : "register");
window.openSignupPage = openSignupPage;
showScreen("signup");
signupEmail.setAttribute("aria-invalid", "false");
signupPassword.setAttribute("aria-invalid", "false");
showSignupMessage("", false);
requestAnimationFrame(function () {
initSignupPlasma();
signupEmail.focus({ preventScroll: true });
});
}
window.openSignupPage = openSignupPage;
window.showScreen = showScreen;
const introLoginBtn = document.getElementById("intro-login-btn");
if (introLoginBtn) introLoginBtn.addEventListener("click", function () { openSignupPage("login"); });
const gotoLogin = document.getElementById("goto-login");
if (gotoLogin) gotoLogin.addEventListener("click", function () { setSignupMode("login"); });
const gotoRegister = document.getElementById("goto-register");
if (gotoRegister) gotoRegister.addEventListener("click", function () { setSignupMode("register"); });
subscriptionContinue.addEventListener("click", function () {
if (localStorage.getItem("armox-session-v8")) {
if (typeof closeArmoxOnboard === "function") closeArmoxOnboard();
return;
}
if (subscriptionScreen.dataset.selectedPlan === "trial") {
openSignupPage();
} else {
hapticTick([8, 24, 8]);
}
});
function enterArmoxApp(){
try { localStorage.setItem("armox-session", "1"); localStorage.setItem("armox-session-v8", "1"); } catch (e) {}
try {
const prev = JSON.parse(localStorage.getItem("armox-profile") || "{}");
const type = (characterScreen && characterScreen.dataset.selectedCharacter) || prev.character || "man";
const src = (typeof characters !== "undefined" && characters[type]) ? characters[type].src : "images/avatars/758539740_armox-man.png";
if (!prev.photoCustom) prev.photo = src;
prev.character = type;
if (nameInput && nameInput.value.trim()) prev.username = nameInput.value.trim();
localStorage.setItem("armox-profile", JSON.stringify(prev));
} catch (e) {}
try { localStorage.setItem("armox-local-account", JSON.stringify({ plan: "trial", createdAt: new Date().toISOString() })); } catch (e) {}
var g = document.getElementById("onboardGate");
if (g) g.style.display = "none";
document.body.style.overflow = "";
}
signupForm.addEventListener("submit", function (event) {
event.preventDefault();
const email = signupEmail.value.trim();
const password = signupPassword.value;
const emailValid = signupEmail.checkValidity();
const passwordValid = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
signupEmail.setAttribute("aria-invalid", emailValid ? "false" : "true");
signupPassword.setAttribute("aria-invalid", passwordValid ? "false" : "true");
if (!emailValid) {
showSignupMessage("لطفاً یک ایمیل معتبر وارد کنید.", false);
signupEmail.focus();
hapticTick([8, 24, 8]);
return;
}
if (!passwordValid) {
showSignupMessage("رمز عبور باید حداقل ۸ کاراکتر و شامل حرف و عدد باشد.", false);
signupPassword.focus();
hapticTick([8, 24, 8]);
return;
}
const privacyOk = document.getElementById("signup-privacy-check");
if (privacyOk && !privacyOk.checked) {
showSignupMessage("برای ادامه باید حریم خصوصی و امنیت را بخوانید و تیک بزنید.", false);
hapticTick([8, 24, 8]);
return;
}
try {
localStorage.setItem("armox-local-account", JSON.stringify({
email: email,
plan: "trial",
createdAt: new Date().toISOString()
}));
} catch (error) {
}
showSignupMessage("ثبت‌نام با موفقیت انجام شد.", true);
signupForm.querySelector(".signup-submit").textContent = "ثبت شد";
hapticTick([16, 30, 18]);
setTimeout(enterArmoxApp, 450);
});
signupGoogle.addEventListener("click", function () {
const privacyOk = document.getElementById("signup-privacy-check");
if (privacyOk && !privacyOk.checked) {
showSignupMessage("برای ادامه باید حریم خصوصی و امنیت را بخوانید و تیک بزنید.", false);
hapticTick([8, 24, 8]);
return;
}
showSignupMessage("در حال ورود…", true);
hapticTick(9);
setTimeout(enterArmoxApp, 280);
});
const privLink = document.getElementById("signup-privacy-link");
const privBox = document.getElementById("signup-privacy-box");
if (privLink && privBox) {
privLink.addEventListener("click", function (e) {
e.preventDefault();
privBox.classList.toggle("on");
});
}
updateLifeChoice();
})();

/* === split script === */

(function(){
try {
var logged = localStorage.getItem("armox-session") || localStorage.getItem("armox-session-v8") || localStorage.getItem("armox-session-v7") || localStorage.getItem("armox-profile");
if (logged) {
var g = document.getElementById("onboardGate");
if (g) { g.classList.add("done"); g.style.display = "none"; }
}
} catch (e) {}
})();

/* === split script === */

const LEVELS = [
{n:1,src:"images/levels/level-01.png"},
{n:2,src:"images/levels/level-02.png"},
{n:3,src:"images/levels/level-03.png"},
{n:4,src:"images/levels/level-04.png"},
{n:5,src:"images/levels/level-05.png"},
{n:6,src:"images/levels/level-06.png"},
{n:7,src:"images/levels/level-07.png"},
{n:8,src:"images/levels/level-08.png"},
{n:9,src:"images/levels/level-09.png"},
{n:10,src:"images/levels/level-10.png"},
{n:11,src:"images/levels/level-11.png"},
{n:12,src:"images/levels/level-12.png"},
{n:13,src:"images/levels/level-13.png"},
{n:14,src:"images/levels/level-14.png"},
{n:15,src:"images/levels/level-15.png"},
{n:16,src:"images/levels/level-16.png"},
{n:17,src:"images/levels/level-17.png"},
{n:18,src:"images/levels/level-18.png"},
{n:19,src:"images/levels/level-19.png"},
{n:20,src:"images/levels/level-20.png"},
{n:21,src:"images/levels/level-21.png"}
];
const MAX = LEVELS.length;
const STEP = 500;
const DAY = 24*60*60*1000;
const KEY = "arox-v2";
const EMOJIS = (
"😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗☺️😚😙🥲😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳🥸😎🤓🧐😕😟🙁☹️😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠️💩🤡👹👺👻👽👾🤖😺😸😹😻😼😽🙀😿😾"+
"👋🤚🖐️✋🖖👌🤌🤏✌️🤞🤟🤘🤙👈👉👆🖕👇☝️👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏✍️💅🤳💪🦾🦵🦿🦶👂🦻👃🧠🫀🫁🦷🦴👀👁️👅👄💋"+
"👶👧🧒👦👩🧑👨👵🧓grandfather"+
"🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🙉🙊🐒🐔🐧🐦🐤🐣🐥🦆🦅🦉🦇🐺🐗🐴🦄🐝🪱🐛🦋🐌🐞🐜🪰🪲🪳🦟🦗🕷🦂🐢🐍🦎🦖🦕🐙🦑🦐🦞🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🦧🐘🦛🦏🐪🐫🦒🦘🦬🐃🐂🐄🐎🐖🐏🐑🦙🐐🦌🐕🐩🦮🐈🪶🐓🦃🦤🦚🦜🦢🦩🕊🐇🦝🦨🦡🦫🦦🦥🐁🐀🐿🦔"+
"🌵🎄🌲🌳🌴🪵🌱🌿☘️🍀🎍🪴🎋🍃🍂🍁🪺🪹🍄🐚🪸🪨🌾💐🌷🌹🥀🌺🌸🌼🌻🌞🌝🌛🌜🌚🌕🌖🌗🌘🌑🌒🌓🌔🌙🌎🌍🌏🪐💫⭐🌟✨⚡☄️💥🔥🌪🌈☀️🌤⛅🌥☁️🌦🌧⛈🌩🌨❄️☃️⛄🌬💨💧💦🫧☔️☂️🌊🌫"+
"🍏🍎🍐🍊🍋🍌🍉🍇🍓🫐🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥬🥒🌶🫑🌽🥕🫒🧄🧅🥔🍠🥐🥯🍞🥖🥨🧀🥚🍳🧈🥞🧇🥓🥩🍗🍖🦴🌭🍔🍟🍕🫓🥪🥙🧆🌮🌯🫔🥗🥘🫕🥫🍝🍜🍲🍛🍣🍱🥟🦪🍤🍙🍚🍘🍥🥠🥮🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🌰🥜🍯🥛🍼🫖☕️🍵🧃🥤🧋🍶🍺🍻🥂🍷🥃🍸🍹🧉🍾🧊🥄🍴🍽🥣🥡🥢🧂"+
"⚽️🏀🏈⚾️🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🪃🥅⛳️🪁🏹🎣🤿🥊🥋🎽🛹🛼🛷⛸🥌🎿⛷🏂🪂🏋️‍♀️🤼‍♂️🤸‍♀️🤺🧘‍♀️🏆🥇🥈🥉🎮🕹🎲🧩🎭🎨🎬🎤🎧🎼🎹🥁🎷🎺🪗🎸🪕🎻"+
"🚗🚕🚙🚌🚎🏎🚓🚑🚒🚐🛻🚚🚛🚜🦯🦽🦼🛴🚲🛵🏍🛺🚨🚔🚍🚘🚖🚡🚠🚟🚃🚋🚞🚝🚄🚅🚈🚂🚆🚇🚊🚉✈️🛫🛬🛩💺🛰🚀🛸🚁🛶⛵️🚤🛥🛳⛴🚢⚓️🪝⛽️🚧🚦🚥🚏🗺🗿🗽🗼🏰🏯🏟️🎡🎢🎠⛲️⛱🏖🏝🏜🌋⛰🏔🗻🏕⛺️🛖🏠🏡🏘🏚🏗🏭🏢🏬🏣🏤🏥🏦🏨🏪🏫🏩💒🏛⛪️🕌🕍🛕🕋⛩️🛤🛣🗾🎑🏞🌅🌄🌠🎇🎆🌇🌆🏙🌃🌌🌉🌁"+
"⌚️📱💻⌨️🖥🖨🖱️🖲🕹🗜💾💿📀📼📷📸📹🎥📽🎞📞☎️📟📠📺📻🎙🎚🎛🧭⏱⏲⏰🕰⌛️⏳📡🔋🔌💡🔦🕯🪔🧯🛢💸💵💴💶💷🪙💰💳💎⚖️🪜🧰🪛🔧🔨⚒🛠⛏🪚🔩⚙️🪤🧱⛓🧲🔫💣🧨🪓🔪🗡⚔️🛡🚬⚰️🪦⚱️🏺🔮📿🧿🪬💈🔭🔬🕳🩹🩺💊💉🩸🧬🦠🧫🧪🌡🧹🪠🧺🧻🚽🚰🚿🛁🛀🧼🪥🪒🧽🪣🧴🛎🔑🗝🚪🪑🛋🛏🛌🧸🪆🖼🪞🪟🛍🛒🎁🎈🎏🎀🪄🪅🎊🎉🎎🏮🎐🧧✉️📩📨📧💌📥📤📦🏷🪧📪📫📬📭📮📯📜📃📄📑🧾📊📈📉🗒🗓📆📅🗑📇🗃🗳🗄📋📁📂🗂🗞📰📓📔📒📕📗📘📙📚📖🔖🧷🔗📎🖇📐📏🧮📌📍✂️🖊🖋✒️🖌🖍📝✏️🔍🔎🔏🔐🔒🔓"
).replace(/grandfather/g,"");
const NAMES = ["سلاح چوبی","سلاح نقره‌ای","سلاح آبی فلزی","سلاح طلایی","سلاح فضایی","سپر چوبی","سپر آبی فلزی","سپر طلایی","سپر فضایی","تیر و کمان چوبی","تیر و کمان آبی فلزی","تیر و کمان طلایی","تیر و کمان فضایی","زنجیر چوبی","زنجیر آبی فلزی","زنجیر طلایی","زنجیر فضایی","پله چوبی","پله فلزی آبی","پله طلایی","پله فضایی"];
function load(){
let goals = [];
let xp = 0;
let xpClaimed = false;
try {
const raw = JSON.parse(localStorage.getItem(KEY) || "null");
if (raw && typeof raw === "object") {
if (Array.isArray(raw.goals)) goals = raw.goals;
if (typeof raw.xp === "number") xp = raw.xp;
if (typeof raw.xpClaimed === "boolean") xpClaimed = raw.xpClaimed;
}
} catch(e){}
if (!goals.length) {
try {
const old = JSON.parse(localStorage.getItem("arox-goals-v1") || "[]");
if (Array.isArray(old) && old.length) goals = old;
} catch(e){}
}
try {
const bak = JSON.parse(localStorage.getItem("arox-goals-backup") || "[]");
if (Array.isArray(bak) && bak.length > goals.length) goals = bak;
} catch(e){}
goals = goals.filter(g => g && g.id && typeof g.text === "string").map(g => ({
id: g.id,
text: g.text,
emoji: g.emoji || "🎯",
done: !!g.done,
checkedAt: g.checkedAt || null,
createdAt: g.createdAt || Date.now()
}));
return { xp, goals, xpClaimed };
}
const state = load();
function persist(){
if (!Array.isArray(state.goals)) state.goals = [];
localStorage.setItem(KEY, JSON.stringify(state));
localStorage.setItem("arox-goals-backup", JSON.stringify(state.goals));
}
function levelOf(xp){ return Math.min(MAX, Math.floor(xp / STEP) + 1); }
function needFor(level){ return (level - 1) * STEP; }
function toFa(n){ return String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]); }
function sameLocalDay(ts){
const a = new Date(Number(ts));
const b = new Date();
return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function dailyReset(){
if (!Array.isArray(state.goals)) state.goals = [];
let changed = false;
const now = Date.now();
for (let i = 0; i < state.goals.length; i++){
const g = state.goals[i];
if (!g) continue;
const when = Number(g.checkedAt);
if (g.done && when && (!sameLocalDay(when) || (now - when >= DAY))) {
g.done = false;
g.checkedAt = null;
changed = true;
}
}
if (changed) { state.xpClaimed = false; persist(); }
}
function setGauge(p){
p = Math.max(0, Math.min(100, p));
document.getElementById("gaugePri").style.setProperty("--stroke-percent", p);
}
const BOARD = [
["آریا",350000],["باران",341026],["سارینا",332052],["کیان",323078],["هلیا",314104],
["داریوش",305130],["نیکا",296156],["رادین",287182],["آوا",278208],["سیاوش",269234],
["مهرسا",260260],["یاسین",251286],["دیانا",242312],["آدرین",233338],["شایان",224364],
["رها",215390],["آرتین",206416],["الناز",197442],["سام",188468],["ترنم",179494],
["هیراد",170520],["آیلین",161546],["ارشیا",152572],["غزل",143598],["پویا",134624],
["کیمیا",125650],["پارسا",116676],["مهراد",107702],["آنیسا",98728],["امیرعلی",89754],
["ریحانه",80780],["فرزاد",71806],["هانا",62832],["اهورا",53858],["شیدا",44884],
["آرمان",35910],["مهسا",26936],["بهراد",17962],["نیایش",8988],["آرمیتا",0]
];
function faNum(n){
return toFa(String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "٬"));
}
function npcRank(npcXp, youXp){
const betterNpc = BOARD.filter(x => x[1] > npcXp).length;
const youAbove = youXp > npcXp ? 1 : 0;
return betterNpc + youAbove + 1;
}
function renderRank(){
const youXp = state.xp|0;
const better = BOARD.filter(x => x[1] > youXp).length;
const youRank = better + 1;
const lb = document.getElementById("lb");
if (!lb) return;
const people = BOARD.map(([name, xp]) => ({name, xp, you:false}));
const insertAt = people.findIndex(p => p.xp < youXp);
const you = {name:"تو", xp:youXp, you:true};
if (insertAt === -1) people.push(you);
else people.splice(insertAt, 0, you);
const top = people.slice(0, 3);
const slots = [
document.querySelector("#p1 .pname"),
document.querySelector("#p2 .pname"),
document.querySelector("#p3 .pname")
];
const xps = [
document.querySelector("#p1 .pxp"),
document.querySelector("#p2 .pxp"),
document.querySelector("#p3 .pxp")
];
top.forEach((p, i) => {
if (!p || !slots[i]) return;
slots[i].textContent = p.name;
xps[i].textContent = faNum(p.xp) + " XP";
});
const youCard = `<div class="lb-row you-row" id="youInList">
<div class="n" style="background:#fff;color:#000;font-weight:800">${toFa(youRank)}</div>
<div class="nm">رتبه تو</div>
<div class="xp">${faNum(youXp)} XP</div>
</div>`;
lb.innerHTML = people.map((row, i) => {
const r = i + 1;
if (r <= 3) return "";
if (row.you) return youCard;
return `<div class="lb-row"><div class="n">${toFa(npcRank(row.xp, youXp))}</div><div class="nm">${row.name}</div><div class="xp">${faNum(row.xp)} XP</div></div>`;
}).join("");
document.getElementById("youRank").textContent = toFa(youRank);
document.getElementById("youXp").textContent = faNum(youXp) + " XP";
bindYouFloat();
}
function bindYouFloat(){
const yf = document.getElementById("youFloat");
const pin = document.getElementById("youInList");
const main = document.getElementById("main");
if (!yf) return;
yf.classList.remove("hidden");
if (bindYouFloat._io) { try { bindYouFloat._io.disconnect(); } catch(e){} bindYouFloat._io = null; }
if (!pin || !main) { yf.classList.remove("hidden"); return; }
const io = new IntersectionObserver((entries) => {
const vis = entries.some(e => e.isIntersecting);
yf.classList.toggle("hidden", vis);
}, { root: main, threshold: 0.55, rootMargin: "0px 0px -70px 0px" });
io.observe(pin);
bindYouFloat._io = io;
}
function goPage(page){
document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === "page-"+page));
document.querySelectorAll("nav a").forEach(a => a.classList.toggle("active", a.dataset.page === page));
document.getElementById("main").scrollTop = 0;
if (page === "book") renderAlbum();
if (page === "rank") renderRank();
if (page === "settings") renderSettings();
}
function toast(msg){
const t = document.getElementById("toast");
t.textContent = msg;
t.classList.add("on");
clearTimeout(toast._id);
toast._id = setTimeout(() => t.classList.remove("on"), 2600);
}
function showLevelUp(lv){
const L = LEVELS[lv-1];
document.getElementById("luImg").src = L.src;
document.getElementById("luTitle").textContent = "سطح " + toFa(lv) + " باز شد";
const el = document.getElementById("levelup");
el.classList.add("on");
setTimeout(() => el.classList.remove("on"), 2600);
}
function maybeClaim(){
if (!state.goals.length) return;
if (!state.goals.every(g => g.done)) return;
if (state.xpClaimed) return;
const before = levelOf(state.xp);
state.xp += 25;
state.xpClaimed = true;
persist();
const after = levelOf(state.xp);
const f = document.getElementById("xpFloat");
f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
paint();
if (after > before) {
setTimeout(() => showLevelUp(after), 350);
}
}
function paint(){
dailyReset();
const lv = levelOf(state.xp);
const base = needFor(lv);
const nextNeed = lv >= MAX ? base : needFor(lv+1);
const into = state.xp - base;
const span = STEP;
const pct = lv >= MAX ? 100 : (into / span) * 100;
setGauge(pct);
var el;
el = document.getElementById("xpCount"); if(el) el.textContent = toFa(state.xp);
el = document.getElementById("orbImg"); if(el && LEVELS[lv-1]) el.src = LEVELS[lv-1].src;
el = document.getElementById("lvlTitle"); if(el) el.textContent = "سطح " + toFa(lv);
el = document.getElementById("lvlSub"); if(el) el.textContent = lv >= MAX
? "آخرین سطح را گرفتی"
: toFa(into) + " / " + toFa(STEP) + " XP تا سطح " + toFa(lv+1);
var empty = document.getElementById("empty");
var list = document.getElementById("list");
if(empty) empty.style.display = state.goals.length ? "none" : "block";
if(list){
const sorted = [...state.goals].sort((a,b)=> Number(a.done)-Number(b.done) || b.createdAt-a.createdAt);
list.innerHTML = sorted.map(g => `
<article class="card ${g.done ? "done" : ""}" data-id="${g.id}">
<div class="emoji">${g.emoji}</div>
<p>${esc(g.text)}</p>
<button class="check press" aria-label="انجام شد"><i>${g.done ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : ""}</i></button>
</article>`).join("");
}
}
if (document.getElementById("page-rank").classList.contains("active")) renderRank();
function renderAlbum(){
const lv = levelOf(state.xp);
const box = document.getElementById("album");
if(!box) return;
box.innerHTML = LEVELS.map((L,i) => {
const n = i+1;
const open = n <= lv;
const need = needFor(n);
return `<button class="tile press ${open?"":"locked"}" data-n="${n}">
<img src="${L.src}" alt="سطح ${n}" loading="lazy" />
<span>سطح ${toFa(n)}</span>
<small style="display:block;font-size:11px;opacity:.8;margin-top:2px">${open ? "باز شد" : toFa(need) + " XP"}</small>
</button>`;
}).join("");
}
function esc(s){
return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
var _listEl = document.getElementById("list"); if(_listEl) _listEl.addEventListener("click", e => {
const btn = e.target.closest(".check");
if (!btn) return;
const id = btn.closest(".card").dataset.id;
const g = state.goals.find(x => x.id === id);
if (!g) return;
g.done = !g.done;
g.checkedAt = g.done ? Date.now() : null;
persist();
paint();
maybeClaim();
});
var _albumEl = document.getElementById("album"); if(_albumEl) _albumEl.addEventListener("click", e => {
const tile = e.target.closest(".tile");
if (!tile) return;
const n = +tile.dataset.n;
const lv = levelOf(state.xp);
if (n <= lv) {
toast("سطح " + toFa(n) + " را گرفتی — " + NAMES[n-1]);
return;
}
if (n > lv + 1) {
toast("باید به ترتیب پیش بروی. اول سطح " + toFa(lv+1) + " را باز کن.");
return;
}
toast("برای باز شدن سطح " + toFa(n) + " به " + toFa(needFor(n)) + " XP نیاز داری. الان " + toFa(state.xp) + " XP داری.");
});
var _orbEl = document.getElementById("orb"); if(_orbEl) _orbEl.addEventListener("click", () => goPage("book"));
let emoji = "🎯";
const emojisEl = document.getElementById("emojis");
const uniq = Array.from(new Set(Array.from(EMOJIS)));
emojisEl.innerHTML = uniq.map(e => `<b data-e="${e}">${e}</b>`).join("");
emojisEl.addEventListener("click", e => {
const b = e.target.closest("b");
if (!b) return;
emoji = b.dataset.e;
emojisEl.querySelectorAll("b").forEach(x => x.classList.toggle("on", x === b));
});
const overlay = document.getElementById("overlay");
const input = document.getElementById("goalText");
const saveBtn = document.getElementById("saveGoal");
var _openSheet = document.getElementById("openSheet"); if(_openSheet) _openSheet.onclick = () => { overlay.classList.add("on"); input.focus(); };
const close = () => overlay.classList.remove("on");
var _closeSheet = document.getElementById("closeSheet"); if(_closeSheet) _closeSheet.onclick = close;
var _closeSheet2 = document.getElementById("closeSheet2"); if(_closeSheet2) _closeSheet2.onclick = close;
input.addEventListener("input", () => saveBtn.disabled = !input.value.trim());
input.addEventListener("keydown", e => { if (e.key === "Enter") addGoal(); });
function addGoal(){
const text = input.value.trim();
if (!text) return;
state.goals.unshift({ id: Date.now().toString(36)+Math.random().toString(36).slice(2,6), text, emoji, done:false, checkedAt:null, createdAt: Date.now() });
input.value = ""; saveBtn.disabled = true;
persist(); paint(); close();
}
saveBtn.onclick = addGoal;
const PROF_KEY = "armox-profile";
const DEFAULT_CHARS = {
man: "images/avatars/758539740_armox-man.png",
woman: "images/avatars/758539800_armox-woman.png"
};
function loadProfile(){
try {
const p = JSON.parse(localStorage.getItem(PROF_KEY) || "{}");
if (p && typeof p === "object") return p;
} catch(e){}
return {};
}
function saveProfile(p){
localStorage.setItem(PROF_KEY, JSON.stringify(p));
}
function renderSettings(){
const p = loadProfile();
const img = document.getElementById("setAvatar");
const nameEl = document.getElementById("setName");
const idEl = document.getElementById("setId");
if (!img) return;
img.src = p.photo || DEFAULT_CHARS[p.character || "man"];
nameEl.textContent = (p.displayName && p.displayName.trim()) ? p.displayName.trim() : "اسمت هنوز ثبت نشده";
idEl.textContent = p.username ? ("@" + p.username) : "@user";
}
function openSetEdit(){
const p = loadProfile();
document.getElementById("setNameInput").value = p.displayName || "";
document.getElementById("setIdInput").value = p.username || "";
document.getElementById("setOverlay").classList.add("on");
}
function closeSetEdit(){
document.getElementById("setOverlay").classList.remove("on");
}
document.getElementById("setEdit").onclick = openSetEdit;
document.getElementById("setBtnProfile").onclick = openSetEdit;
document.getElementById("setClose1").onclick = closeSetEdit;
document.getElementById("setClose2").onclick = closeSetEdit;
document.getElementById("setBtnPrivacy").onclick = () => {
const pan = document.getElementById("setPrivacy");
pan.hidden = !pan.hidden;
};
document.getElementById("setBtnSub").onclick = () => {
if (typeof openArmoxSubscription === "function") openArmoxSubscription();
};
document.getElementById("setBtnLogout").onclick = () => {
try { localStorage.removeItem("armox-session"); localStorage.removeItem("armox-session-v8"); localStorage.removeItem("armox-session-v7"); } catch(e){}
const g = document.getElementById("onboardGate");
if (g) { g.classList.remove("done"); g.style.display = "flex"; }
if (typeof openSignupPage === "function") openSignupPage("register");
else if (typeof showScreen === "function") showScreen("signup");
};
document.getElementById("setPickPhoto").onclick = () => document.getElementById("setPhotoInput").click();
document.getElementById("setPhotoInput").addEventListener("change", e => {
const f = e.target.files && e.target.files[0];
if (!f) return;
const r = new FileReader();
r.onload = () => {
const p = loadProfile();
p.photo = r.result;
p.photoCustom = true;
saveProfile(p);
renderSettings();
toast("عکس پروفایل عوض شد");
};
r.readAsDataURL(f);
});
document.getElementById("setSave").onclick = () => {
const p = loadProfile();
p.displayName = document.getElementById("setNameInput").value.trim();
const idv = document.getElementById("setIdInput").value.trim().replace(/^@/, "");
if (idv && !/^[A-Za-z0-9_]+$/.test(idv)) {
toast("آی‌دی فقط انگلیسی، عدد و _ باشد");
return;
}
p.username = idv;
saveProfile(p);
renderSettings();
closeSetEdit();
toast("پروفایل ذخیره شد");
};
(function(){
const sw = document.getElementById("themeSwitch");
if (!sw) return;
function apply(day){
document.documentElement.classList.toggle("day", !!day);
try { localStorage.setItem("armox-theme", day ? "day" : "night"); } catch(e){}
}
try {
if (localStorage.getItem("armox-theme") === "day") { sw.checked = false; apply(true); }
else { sw.checked = true; apply(false); }
} catch(e) { sw.checked = true; apply(false); }
sw.addEventListener("change", function(){ apply(!sw.checked); });
})();
document.getElementById("openSub").addEventListener("click", () => {
if (typeof openArmoxSubscription === "function") openArmoxSubscription();
});
document.querySelectorAll("nav a").forEach(a => {
a.addEventListener("click", ev => {
  // For split pages, allow normal navigation to .html files
  if (a.getAttribute("href") && a.getAttribute("href").endsWith(".html")) return;
  ev.preventDefault(); goPage(a.dataset.page);
});
});
document.addEventListener("pointerdown", e => {
const el = e.target.closest(".press");
if (!el) return;
el.classList.add("pressed");
});
const clearPress = e => {
document.querySelectorAll(".press.pressed").forEach(el => el.classList.remove("pressed"));
};
document.addEventListener("pointerup", clearPress);
document.addEventListener("pointercancel", clearPress);
document.addEventListener("pointerleave", clearPress);
document.getElementById("levelup").addEventListener("click", () => {
document.getElementById("levelup").classList.remove("on");
});
const QUOTES = [
"آفرین تمومش کردی",
"پاشو استراحت کن",
"عالی بود، حالا نفس عمیق بکش",
"کارت تموم شد، یه کم راه برو",
"دمش گرم! وقت پاداشته"
];
let quoteI = 0;
const pomo = {
running: false,
mode: "idle",
left: 25*60,
focusTotal: 25*60,
worked: 0,
focusLeft: 0,
breakEvery: 15*60,
breakDur: 5*60,
tick: null,
alarm: null
};
function clampNum(el, min, max){
let v = parseInt(el.value, 10);
if (isNaN(v)) v = 0;
v = Math.max(min, Math.min(max, v));
el.value = v;
return v;
}
function readFocusSecs(){
var _pH=document.getElementById("pH"); if(!_pH) return 1500;
const h = clampNum(_pH, 0, 23);
const m = clampNum(document.getElementById("pM"), 0, 59);
const s = clampNum(document.getElementById("pS"), 0, 59);
return h*3600 + m*60 + s;
}
function wantsBreak(){ return document.getElementById("breakYes").classList.contains("on"); }
function readBreakEvery(){
if (!wantsBreak()) return 0;
return clampNum(document.getElementById("bEvery"), 1, 180) * 60;
}
function readBreakDur(){
if (!wantsBreak()) return 0;
return clampNum(document.getElementById("bM"), 0, 59)*60 + clampNum(document.getElementById("bS"), 0, 59);
}
function fmtHMS(sec){
sec = Math.max(0, Math.floor(sec));
const h = Math.floor(sec/3600), m = Math.floor((sec%3600)/60), s = sec%60;
const p = n => toFa(String(n).padStart(2,"0"));
return p(h)+":"+p(m)+":"+p(s);
}
function renderClock(){
const clock = document.getElementById("pomoClock"); if(!clock) return;
clock.innerHTML = fmtHMS(pomo.left) + "<small>ساعت : دقیقه : ثانیه</small>";
}
function setPomoMode(text, cls){
var _pm=document.getElementById("pomoMode"); if(!_pm) return; _pm.textContent = text;
const c = document.getElementById("pomoCircle");
c.classList.toggle("running", pomo.running);
c.classList.toggle("break", pomo.mode === "break");
}
function setPlayIcon(pause){
const ic = document.getElementById("pomoIcon"); if(!ic) return;
ic.innerHTML = pause
? '<rect x="6" y="5" width="4.2" height="14" rx="1"></rect><rect x="13.8" y="5" width="4.2" height="14" rx="1"></rect>'
: '<path d="M8 5.5v13l11-6.5z"/>';
}
function stopAlarm(){
if (pomo.alarm){ try{ pomo.alarm(); }catch(e){} pomo.alarm = null; }
}
function playAlarm(seconds){
stopAlarm();
const AC = window.AudioContext || window.webkitAudioContext;
if (!AC) return;
const ctx = new AC();
const gain = ctx.createGain();
gain.connect(ctx.destination);
gain.gain.value = 0.0001;
const osc = ctx.createOscillator();
osc.type = "sine";
osc.frequency.value = 880;
osc.connect(gain);
osc.start();
const start = ctx.currentTime;
let on = true;
const beat = 0.22;
for (let t = 0; t < seconds; t += beat){
const v = on ? 0.14 : 0.0001;
gain.gain.setTargetAtTime(v, start + t, 0.03);
on = !on;
}
gain.gain.setTargetAtTime(0.0001, start + seconds, 0.05);
const stopAt = setTimeout(() => {
try { osc.stop(); ctx.close(); } catch(e){}
if (pomo.alarm) pomo.alarm = null;
}, seconds*1000 + 200);
pomo.alarm = () => { clearTimeout(stopAt); try{ osc.stop(); ctx.close(); }catch(e){} };
}
function showQuote(){
const el = document.getElementById("pomoMsg");
el.textContent = QUOTES[quoteI % QUOTES.length];
quoteI++;
el.classList.add("on");
}
function finishFocus(){
pomo.running = false;
pomo.mode = "done";
pomo.left = 0;
clearInterval(pomo.tick); pomo.tick = null;
setPlayIcon(false);
setPomoMode("تموم شد");
renderClock();
showQuote();
playAlarm(10);
}
function startBreak(){
pomo.focusLeft = pomo.left;
pomo.mode = "break";
pomo.left = pomo.breakDur || 60;
pomo.worked = 0;
setPomoMode("استراحت — پاشو کمی حرکت کن");
}
function startFocusFromSettings(resetWorked){
const total = readFocusSecs();
pomo.focusTotal = total;
pomo.breakEvery = readBreakEvery();
pomo.breakDur = readBreakDur();
if (resetWorked) pomo.worked = 0;
pomo.left = total;
pomo.focusLeft = total;
pomo.mode = "focus";
}
function tickPomo(){
if (!pomo.running) return;
if (pomo.left <= 0){
if (pomo.mode === "break"){
pomo.mode = "focus";
pomo.left = pomo.focusLeft;
pomo.worked = 0;
if (pomo.left <= 0){ finishFocus(); return; }
setPomoMode("دوباره تمرکز");
renderClock();
return;
}
finishFocus();
return;
}
pomo.left -= 1;
if (pomo.mode === "focus"){
pomo.worked += 1;
if (pomo.breakEvery > 0 && pomo.breakDur > 0 && pomo.worked >= pomo.breakEvery && pomo.left > 0){
startBreak();
}
}
renderClock();
}
function togglePomo(){
if (pomo.running){
pomo.running = false;
clearInterval(pomo.tick); pomo.tick = null;
setPlayIcon(false);
setPomoMode(pomo.mode === "break" ? "استراحت متوقف شد" : "متوقف شد");
return;
}
document.getElementById("pomoMsg").classList.remove("on");
stopAlarm();
if (pomo.mode === "idle" || pomo.mode === "done"){
const total = readFocusSecs();
if (total <= 0){ toast("اول زمان تمرکز را تنظیم کن"); return; }
startFocusFromSettings(true);
}
pomo.running = true;
setPlayIcon(true);
setPomoMode(pomo.mode === "break" ? "در حال استراحت" : "در حال تمرکز");
renderClock();
clearInterval(pomo.tick);
pomo.tick = setInterval(tickPomo, 1000);
}
var _tmp = document.getElementById("pomoPlay"); if(_tmp) var _pomoPlay=document.getElementById("pomoPlay"); if(_pomoPlay) _pomoPlay.addEventListener("click", togglePomo);
function applyNewFocus(){
const total = readFocusSecs();
if (total <= 0){ toast("اول زمان تمرکز را تنظیم کن"); return; }
stopAlarm();
document.getElementById("pomoMsg").classList.remove("on");
pomo.running = false;
clearInterval(pomo.tick); pomo.tick = null;
startFocusFromSettings(true);
pomo.running = false;
pomo.mode = "idle";
pomo.left = total;
setPlayIcon(false);
setPomoMode("زمان جدید تأیید شد — برای شروع پخش را بزن");
renderClock();
toast("زمان جدید از اول آماده است");
}
var _tmp = document.getElementById("pomoApply"); if(_tmp) var _pomoApply=document.getElementById("pomoApply"); if(_pomoApply) _pomoApply.addEventListener("click", applyNewFocus);
function setBreakWant(yes){
document.getElementById("breakYes").classList.toggle("on", yes);
document.getElementById("breakNo").classList.toggle("on", !yes);
document.getElementById("breakFields").classList.toggle("on", yes);
pomo.breakEvery = readBreakEvery();
pomo.breakDur = readBreakDur();
}
var _tmp = document.getElementById("breakYes"); if(_tmp) var _breakYes=document.getElementById("breakYes"); if(_breakYes) _breakYes.addEventListener("click", () => setBreakWant(true));
var _tmp = document.getElementById("breakNo"); if(_tmp) var _breakNo=document.getElementById("breakNo"); if(_breakNo) _breakNo.addEventListener("click", () => setBreakWant(false));
pomo.left = readFocusSecs();
renderClock();
setInterval(() => { dailyReset(); paint(); }, 60 * 1000);
paint();
maybeClaim();
// MPA init: render correct page content when loaded as separate HTML file
(function(){
  try{
    var activePage = document.querySelector('.page.active');
    if(activePage){
      var id = activePage.id || '';
      if(id === 'page-book' && typeof renderAlbum === 'function'){ renderAlbum(); }
      if(id === 'page-rank' && typeof renderRank === 'function'){ renderRank(); }
      if(id === 'page-settings' && typeof renderSettings === 'function'){ renderSettings(); }
      // Ensure orb image is set for home
      if(id === 'page-home' && typeof paint === 'function'){ /* paint already did */ }
    }
  }catch(e){}
})();