/*
  Ball Knowledge: small extras on top of a page that already works without them.

  - Stamps "CASE CLOSED" on the picture (with confetti) the first time you see it
  - Every "Look at the picture" link takes you straight back to Exhibit A
  - Count-up numbers, scroll reveals, looping tickers and a share button

  Everything that moves respects "reduce motion" in your OS settings.
*/
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const motionOK = () => !reduceMotion.matches;

  try {
    const confetti = createConfetti();
    setupExhibit(confetti);
    setupReveals();
    setupShare();
    setupTapes();
  } catch (error) {
    // If anything breaks, never leave content hidden.
    root.classList.remove("js");
    throw error;
  }

  /* ------------------------------------------------------------------------
     Exhibit A
     ------------------------------------------------------------------------ */

  function setupExhibit(confetti) {
    const section = document.getElementById("exhibit-a");
    const frame = document.querySelector(".exhibit__frame");
    const stamp = document.querySelector(".stamp");
    if (!section || !frame || !stamp) return;

    section.setAttribute("tabindex", "-1");
    let stamped = false;

    const slam = () => {
      stamped = true;
      restartClass(stamp, "is-stamped");
      restartClass(frame, "is-hit");
      window.setTimeout(() => cannons(confetti), 250);
    };

    if (motionOK() && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer.disconnect();
            slam();
          }
        },
        { rootMargin: "-35% 0px -35% 0px" } // when the picture reaches the middle of the screen
      );
      observer.observe(frame);
    } else {
      stamped = true;
      stamp.classList.add("is-stamped");
    }

    // Clicking the picture: more confetti, obviously.
    frame.addEventListener("click", (event) => {
      confetti.burst({ x: event.clientX, y: event.clientY, spread: 360, count: 70, speed: [4, 13] });
    });

    // Every "Look at the picture" link brings you back here.
    document.addEventListener("click", (event) => {
      const link = event.target.closest('a[href="#exhibit-a"]');
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      event.preventDefault();
      const returning = stamped; // the first visit is handled by the observer above
      frame.scrollIntoView({ behavior: motionOK() ? "smooth" : "auto", block: "center" });
      section.focus({ preventScroll: true });

      whenScrollEnds(() => {
        restartClass(frame, "is-pinged");
        if (returning && motionOK()) slam();
      });
    });
  }

  function cannons(confetti) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Aim steeper on tall, narrow screens so the confetti doesn't fly straight off the side.
    const tilt = Math.min(34, Math.max(12, (width / height) * 20));
    const speed = [height * 0.03, height * 0.05];
    const count = width < 600 ? 55 : 85;
    confetti.burst({ x: 0, y: height, angle: -90 + tilt, spread: 30, count, speed });
    confetti.burst({ x: width, y: height, angle: -90 - tilt, spread: 30, count, speed });
  }

  function whenScrollEnds(callback) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("scrollend", finish);
      callback();
    };
    window.addEventListener("scrollend", finish);
    window.setTimeout(finish, "onscrollend" in window ? 1200 : 700);
  }

  function restartClass(element, className) {
    element.classList.remove(className);
    void element.offsetWidth; // reflow, so the animation plays again
    element.classList.add(className);
  }

  /* ------------------------------------------------------------------------
     Scroll reveals + count-up numbers
     ------------------------------------------------------------------------ */

  function setupReveals() {
    const items = document.querySelectorAll("[data-reveal]");

    if (!motionOK() || !("IntersectionObserver" in window)) {
      items.forEach((item) => item.classList.add("is-in"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        let order = 0;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const item = entry.target;
          const delay = order * 90; // things that appear together arrive one after another
          order += 1;
          item.style.setProperty("--delay", `${delay}ms`);
          item.classList.add("is-in");
          item.querySelectorAll("[data-count]").forEach((number) => countUp(number, delay + 120));
          observer.unobserve(item);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.15 }
    );

    items.forEach((item) => observer.observe(item));
  }

  function countUp(element, delay) {
    const target = Number(element.dataset.count);
    if (!Number.isFinite(target)) return;

    const duration = 1100 + Math.min(target, 60) * 10;
    element.textContent = "0";

    window.setTimeout(() => {
      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        element.textContent = String(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
  }

  /* ------------------------------------------------------------------------
     Share
     ------------------------------------------------------------------------ */

  function setupShare() {
    const toastEl = document.querySelector(".toast");
    const url = window.location.href.split("#")[0];
    const shareData = {
      title: "Why is Messi the GOAT?",
      text: "Why is Messi the GOAT? It’s simple. Look at the picture.",
      url,
    };
    let hideTimer = 0;

    const toast = (message) => {
      if (!toastEl) return;
      toastEl.textContent = message;
      toastEl.classList.add("is-visible");
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => toastEl.classList.remove("is-visible"), 2800);
    };

    const copyLink = async () => {
      try {
        await navigator.clipboard.writeText(url);
        toast("Link copied. Go ruin a Ronaldo fan’s day.");
      } catch {
        toast("Copy the link from the address bar and send it anyway.");
      }
    };

    document.querySelectorAll("[data-share]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (navigator.share) {
          try {
            await navigator.share(shareData);
          } catch (error) {
            if (error && error.name !== "AbortError") copyLink();
          }
          return;
        }
        copyLink();
      });
    });
  }

  /* ------------------------------------------------------------------------
     Tickers: repeat the list until it can loop seamlessly
     ------------------------------------------------------------------------ */

  function setupTapes() {
    if (!motionOK()) return;

    const tracks = Array.from(document.querySelectorAll(".tape__track")).map((track) => ({
      track,
      originals: Array.from(track.children),
    }));

    const build = ({ track, originals }) => {
      track.querySelectorAll("[data-clone]").forEach((clone) => clone.remove());

      const setWidth = track.offsetWidth;
      const visibleWidth = track.parentElement.offsetWidth;
      if (!setWidth || !visibleWidth) return;

      // The track is two identical halves; sliding it by -50% loops perfectly.
      const setsPerHalf = Math.ceil(visibleWidth / setWidth);
      const fragment = document.createDocumentFragment();
      for (let set = 1; set < setsPerHalf * 2; set += 1) {
        originals.forEach((item) => {
          const clone = item.cloneNode(true);
          clone.setAttribute("aria-hidden", "true");
          clone.dataset.clone = "";
          fragment.append(clone);
        });
      }
      track.append(fragment);
      track.style.setProperty("--duration", `${(setWidth * setsPerHalf) / 60}s`);
      track.classList.add("is-looping");
    };

    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(() => tracks.forEach(build));

    let lastWidth = window.innerWidth;
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      if (window.innerWidth === lastWidth) return; // ignore mobile address-bar resizes
      lastWidth = window.innerWidth;
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => tracks.forEach(build), 200);
    });
  }

  /* ------------------------------------------------------------------------
     Confetti (sky blue, white and gold, naturally)
     ------------------------------------------------------------------------ */

  function createConfetti() {
    const colors = ["#75aadb", "#a9cdef", "#ffffff", "#f2c14e", "#ffe7a3"];
    let canvas = null;
    let ctx = null;
    let particles = [];
    let frameId = 0;
    let last = 0;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const ensureCanvas = () => {
      if (canvas) return;
      canvas = document.createElement("canvas");
      canvas.className = "confetti";
      canvas.setAttribute("aria-hidden", "true");
      document.body.append(canvas);
      ctx = canvas.getContext("2d");
      resize();
      window.addEventListener("resize", resize);
    };

    const random = (min, max) => min + Math.random() * (max - min);

    const tick = (now) => {
      const step = Math.min((now - last) / 16.667, 3); // keep the speed the same on 60Hz and 120Hz screens
      last = now;

      const width = window.innerWidth;
      const height = window.innerHeight;
      ctx.clearRect(0, 0, width, height);

      particles = particles.filter((p) => p.age < p.life && p.y < height + 40);
      for (const p of particles) {
        p.age += step;
        p.vx *= Math.pow(0.965, step);
        p.vy = p.vy * Math.pow(0.96, step) + 0.3 * step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.rotation += p.spin * step;
        p.wobble += p.wobbleSpeed * step;

        ctx.save();
        ctx.globalAlpha = Math.min(1, (p.life - p.age) / 25);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(1, Math.cos(p.wobble));
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }

      frameId = particles.length ? requestAnimationFrame(tick) : 0;
    };

    const burst = ({ x, y, angle = -90, spread = 60, count = 80, speed = [8, 16] }) => {
      if (!motionOK()) return;
      ensureCanvas();

      for (let i = 0; i < count; i += 1) {
        const direction = ((angle + random(-spread / 2, spread / 2)) * Math.PI) / 180;
        const velocity = random(speed[0], speed[1]);
        particles.push({
          x,
          y,
          vx: Math.cos(direction) * velocity,
          vy: Math.sin(direction) * velocity,
          size: random(7, 13),
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: random(0, Math.PI * 2),
          spin: random(-0.18, 0.18),
          wobble: random(0, Math.PI * 2),
          wobbleSpeed: random(0.08, 0.2),
          round: Math.random() < 0.25,
          age: 0,
          life: random(120, 190),
        });
      }

      if (!frameId) {
        last = performance.now();
        frameId = requestAnimationFrame(tick);
      }
    };

    return { burst };
  }
})();
