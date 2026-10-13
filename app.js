(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const config = window.APP_CONFIG || {};
  const AI_ENDPOINT = String(config.AI_ENDPOINT || "").trim();

  // -----------------------------
  // Tabs
  // -----------------------------
  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".tab").forEach((b) => b.classList.remove("is-active"));
      button.classList.add("is-active");

      $$(".panel").forEach((panel) => panel.classList.add("hidden"));
      $(`[data-panel="${button.dataset.tab}"]`).classList.remove("hidden");
    });
  });

  // -----------------------------
  // Geometry utilities
  // -----------------------------
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function radToDeg(rad) {
    let deg = (rad * 180) / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }

  /**
   * A chord is determined by:
   * - distance d from the center to the chord
   * - angle theta of the perpendicular from center to chord midpoint
   * The chord is perpendicular to that radius.
   */
  function getChordGeometry(cx, cy, radius, distance, angleDeg) {
    const d = clamp(distance, 0, radius - 3);
    const theta = degToRad(angleDeg);

    const nx = Math.cos(theta);
    const ny = Math.sin(theta);

    // Unit vector along chord, perpendicular to the radius toward midpoint
    const ux = -Math.sin(theta);
    const uy = Math.cos(theta);

    const mx = cx + d * nx;
    const my = cy + d * ny;
    const half = Math.sqrt(Math.max(0, radius * radius - d * d));

    return {
      midpoint: { x: mx, y: my },
      p1: { x: mx - half * ux, y: my - half * uy },
      p2: { x: mx + half * ux, y: my + half * uy },
      length: 2 * half,
      distance: d,
      angle: angleDeg
    };
  }

  function setLine(line, p1, p2) {
    line.setAttribute("x1", p1.x);
    line.setAttribute("y1", p1.y);
    line.setAttribute("x2", p2.x);
    line.setAttribute("y2", p2.y);
  }

  function svgPoint(svg, event) {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    return pt.matrixTransform(matrix.inverse());
  }

  function pointToChordState(point, center, radius) {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = clamp(Math.hypot(dx, dy), 0, radius - 5);
    const angle = Math.round(radToDeg(Math.atan2(dy, dx)));
    return { distance, angle };
  }

  // -----------------------------
  // 1. Explore
  // -----------------------------
  const explore = {
    svg: $("#exploreSvg"),
    chord: $("#exploreChord"),
    perp: $("#explorePerp"),
    mid: $("#exploreMid"),
    distanceInput: $("#exploreDistance"),
    angleInput: $("#exploreAngle"),
    distanceValue: $("#exploreDistanceValue"),
    lengthValue: $("#exploreLengthValue"),
    angleValue: $("#exploreAngleValue"),
    distanceLabel: $("#exploreDistanceLabel"),
    lengthLabel: $("#exploreLengthLabel"),
    center: { x: 260, y: 205 },
    radius: 150,
    dragging: false
  };

  function renderExplore() {
    const distance = Number(explore.distanceInput.value);
    const angle = Number(explore.angleInput.value);
    const g = getChordGeometry(
      explore.center.x,
      explore.center.y,
      explore.radius,
      distance,
      angle
    );

    setLine(explore.chord, g.p1, g.p2);
    setLine(explore.perp, explore.center, g.midpoint);

    explore.mid.setAttribute("cx", g.midpoint.x);
    explore.mid.setAttribute("cy", g.midpoint.y);

    const labelX = (explore.center.x + g.midpoint.x) / 2 + 8;
    const labelY = (explore.center.y + g.midpoint.y) / 2 - 8;
    explore.distanceLabel.setAttribute("x", labelX);
    explore.distanceLabel.setAttribute("y", labelY);
    explore.distanceLabel.textContent = `거리 ${distance.toFixed(0)}`;

    explore.lengthLabel.setAttribute("x", g.midpoint.x + 10);
    explore.lengthLabel.setAttribute("y", g.midpoint.y - 14);
    explore.lengthLabel.textContent = `현 ${g.length.toFixed(1)}`;

    explore.distanceValue.textContent = distance.toFixed(0);
    explore.lengthValue.textContent = g.length.toFixed(1);
    explore.angleValue.textContent = `${angle.toFixed(0)}°`;
  }

  explore.distanceInput.addEventListener("input", renderExplore);
  explore.angleInput.addEventListener("input", renderExplore);

  $("#exploreRandom").addEventListener("click", () => {
    explore.distanceInput.value = String(Math.floor(Math.random() * 135));
    explore.angleInput.value = String(Math.floor(Math.random() * 360));
    renderExplore();
  });

  function startExploreDrag(event) {
    explore.dragging = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateExploreFromPointer(event);
  }

  function updateExploreFromPointer(event) {
    if (!explore.dragging) return;
    const p = svgPoint(explore.svg, event);
    if (!p) return;
    const next = pointToChordState(p, explore.center, explore.radius);
    explore.distanceInput.value = String(Math.round(next.distance));
    explore.angleInput.value = String(next.angle);
    renderExplore();
  }

  function endExploreDrag(event) {
    explore.dragging = false;
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch (_) {}
  }

  [explore.chord, explore.mid].forEach((target) => {
    target.addEventListener("pointerdown", startExploreDrag);
    target.addEventListener("pointermove", updateExploreFromPointer);
    target.addEventListener("pointerup", endExploreDrag);
    target.addEventListener("pointercancel", endExploreDrag);
  });

  renderExplore();

  // Observation records
  const records = [];

  function renderRecords() {
    const body = $("#recordBody");

    if (records.length === 0) {
      body.innerHTML = '<tr class="empty-row"><td colspan="3">아직 기록이 없습니다.</td></tr>';
      return;
    }

    body.innerHTML = records
      .map(
        (r) => `
          <tr>
            <td>${r.distance.toFixed(0)}</td>
            <td>${r.angle.toFixed(0)}°</td>
            <td><b>${r.length.toFixed(1)}</b></td>
          </tr>
        `
      )
      .join("");
  }

  $("#recordCurrent").addEventListener("click", () => {
    const distance = Number(explore.distanceInput.value);
    const angle = Number(explore.angleInput.value);
    const g = getChordGeometry(
      explore.center.x,
      explore.center.y,
      explore.radius,
      distance,
      angle
    );

    if (records.length >= 6) records.shift();
    records.push({ distance, angle, length: g.length });
    renderRecords();
  });

  // -----------------------------
  // 2. Hypotheses
  // -----------------------------
  const hypotheses = [
    "중심에 가까울수록 현의 길이는 길어진다.",
    "중심에서 같은 거리에 있는 두 현의 길이는 같을 것이다.",
    "중심에서 멀어질수록 현의 길이가 일정한 크기만큼 줄어들 것 같다.",
    "길이가 같은 두 현은 중심에서의 거리도 같을 것이다."
  ];

  function sanitizeText(text) {
    return String(text).replace(/\s+/g, " ").trim().slice(0, 300);
  }

  function renderHypotheses() {
    const list = $("#hypothesisList");

    if (hypotheses.length === 0) {
      list.innerHTML = '<div class="status">아직 제출된 가설이 없습니다.</div>';
      return;
    }

    list.innerHTML = hypotheses
      .map(
        (h, i) => `
          <div class="hyp-item">
            <small>가설 ${i + 1}</small>
            <div>${escapeHtml(h)}</div>
          </div>
        `
      )
      .join("");
  }

  function escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = String(value);
    return div.innerHTML;
  }

  $("#addHypothesis").addEventListener("click", () => {
    const input = $("#hypothesisInput");
    const text = sanitizeText(input.value);
    if (!text) return;
    hypotheses.push(text);
    input.value = "";
    renderHypotheses();
    resetClusters();
  });

  $("#importHypotheses").addEventListener("click", () => {
    const input = $("#bulkHypotheses");
    const lines = input.value
      .split(/\r?\n/)
      .map(sanitizeText)
      .filter(Boolean);

    if (lines.length === 0) return;

    hypotheses.push(...lines.slice(0, 60));
    input.value = "";
    renderHypotheses();
    resetClusters();
  });

  function resetClusters() {
    $("#clusterOutput").classList.add("hidden");
    $("#aiStatus").classList.add("hidden");
  }

  function setAiStatus(message, type = "") {
    const status = $("#aiStatus");
    status.textContent = message;
    status.className = `status ${type}`.trim();
    status.classList.remove("hidden");
  }

  function localCluster(items) {
    const buckets = {
      same: [],
      trend: [],
      linear: [],
      other: []
    };

    for (const h of items) {
      const text = h.replace(/\s/g, "");

      const isSame =
        (text.includes("같은거리") && text.includes("길이")) ||
        (text.includes("길이가같") && text.includes("거리")) ||
        (text.includes("같은길이") && text.includes("거리"));

      const isLinear =
        text.includes("일정") ||
        text.includes("정비례") ||
        text.includes("비례") ||
        text.includes("1씩") ||
        text.includes("같은크기만큼");

      const isTrend =
        text.includes("가까") ||
        text.includes("멀") ||
        text.includes("증가") ||
        text.includes("감소") ||
        text.includes("길어진") ||
        text.includes("짧아");

      if (isSame) buckets.same.push(h);
      else if (isLinear) buckets.linear.push(h);
      else if (isTrend) buckets.trend.push(h);
      else buckets.other.push(h);
    }

    const groups = [
      {
        label: "거리와 길이의 방향 관계",
        hypotheses: buckets.trend
      },
      {
        label: "같은 거리와 같은 길이의 관계",
        hypotheses: buckets.same
      },
      {
        label: "일정한 변화·비례에 대한 추측",
        hypotheses: buckets.linear
      },
      {
        label: "그 밖의 가설",
        hypotheses: buckets.other
      }
    ].filter((g) => g.hypotheses.length > 0);

    return {
      groups,
      note: "로컬 데모 분류입니다. 가설의 옳고 그름은 판단하지 않았습니다."
    };
  }

  function renderClusterResult(result) {
    const output = $("#clusterOutput");
    const groups = Array.isArray(result.groups) ? result.groups : [];

    output.innerHTML = `
      <strong>우리 반 가설을 이렇게 묶어 볼 수 있습니다.</strong>
      ${groups
        .map(
          (group) => `
            <section class="cluster-group">
              <h4>${escapeHtml(group.label || "가설 묶음")}</h4>
              <ul>
                ${(group.hypotheses || [])
                  .map((h) => `<li>${escapeHtml(h)}</li>`)
                  .join("")}
              </ul>
            </section>
          `
        )
        .join("")}
      <p class="helper">${escapeHtml(result.note || "AI는 정답을 판정하지 않았습니다.")}</p>
      <b>→ 이제 어떤 가설이 항상 참인지 우리가 직접 검증합니다.</b>
    `;

    output.classList.remove("hidden");
  }

  async function clusterWithAI(items) {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        hypotheses: items
      })
    });

    if (!response.ok) {
      throw new Error(`AI endpoint returned ${response.status}`);
    }

    return response.json();
  }

  $("#clusterHypotheses").addEventListener("click", async () => {
    if (hypotheses.length === 0) {
      setAiStatus("먼저 가설을 제출해 주세요.", "warn");
      return;
    }

    const uniqueItems = [...new Set(hypotheses)].slice(0, 60);

    if (!AI_ENDPOINT) {
      const result = localCluster(uniqueItems);
      renderClusterResult(result);
      setAiStatus("현재는 로컬 데모 분류 모드입니다. 정답 판정 없이 표현이 비슷한 가설만 묶었습니다.");
      return;
    }

    try {
      setAiStatus("AI가 가설을 정리하고 있습니다...");
      $("#clusterHypotheses").disabled = true;
      const result = await clusterWithAI(uniqueItems);
      renderClusterResult(result);
      setAiStatus("AI 분류가 완료되었습니다. 분류 기준이 타당한지도 함께 검토해 보세요.", "success");
    } catch (error) {
      console.error(error);
      const fallback = localCluster(uniqueItems);
      renderClusterResult(fallback);
      setAiStatus("AI 연결에 실패하여 로컬 분류로 전환했습니다.", "warn");
    } finally {
      $("#clusterHypotheses").disabled = false;
    }
  });

  renderHypotheses();

  // -----------------------------
  // 3. Verify with two draggable chords
  // -----------------------------
  const verify = {
    svg: $("#verifySvg"),
    center: { x: 260, y: 215 },
    radius: 155,
    a: {
      chord: $("#verifyChordA"),
      perp: $("#verifyPerpA"),
      mid: $("#verifyMidA"),
      distanceInput: $("#distanceA"),
      angleInput: $("#angleA")
    },
    b: {
      chord: $("#verifyChordB"),
      perp: $("#verifyPerpB"),
      mid: $("#verifyMidB"),
      distanceInput: $("#distanceB"),
      angleInput: $("#angleB")
    },
    dragging: null
  };

  function getVerifyState(which) {
    const item = verify[which];
    const distance = Number(item.distanceInput.value);
    const angle = Number(item.angleInput.value);
    return getChordGeometry(
      verify.center.x,
      verify.center.y,
      verify.radius,
      distance,
      angle
    );
  }

  function drawVerifyChord(which) {
    const item = verify[which];
    const g = getVerifyState(which);

    setLine(item.chord, g.p1, g.p2);
    setLine(item.perp, verify.center, g.midpoint);
    item.mid.setAttribute("cx", g.midpoint.x);
    item.mid.setAttribute("cy", g.midpoint.y);

    return g;
  }

  function renderVerify() {
    const ga = drawVerifyChord("a");
    const gb = drawVerifyChord("b");

    $("#dataA").innerHTML = `
      거리 ${ga.distance.toFixed(0)}<br>
      길이 ${ga.length.toFixed(1)}<br>
      방향 ${ga.angle.toFixed(0)}°
    `;

    $("#dataB").innerHTML = `
      거리 ${gb.distance.toFixed(0)}<br>
      길이 ${gb.length.toFixed(1)}<br>
      방향 ${gb.angle.toFixed(0)}°
    `;

    const sameDistance = Math.abs(ga.distance - gb.distance) <= 1;
    const sameLength = Math.abs(ga.length - gb.length) <= 1;

    let text = "거리와 방향을 자유롭게 바꾸어 두 현을 비교해 보세요.";

    if (sameDistance && sameLength) {
      text =
        "중심에서의 거리가 같습니다. 방향은 달라도 두 현의 길이가 같습니다. 이 결과가 우연인지 더 확인해 보세요.";
    } else if (sameLength) {
      text =
        "두 현의 길이가 거의 같습니다. 중심에서의 거리도 같은지 확인해 보세요.";
    } else if (sameDistance) {
      text =
        "중심에서의 거리가 거의 같습니다. 두 현의 길이를 비교해 보세요.";
    }

    $("#relationshipMessage").textContent = text;
  }

  ["#distanceA", "#angleA", "#distanceB", "#angleB"].forEach((selector) => {
    $(selector).addEventListener("input", renderVerify);
  });

  function bindChordDrag(which) {
    const item = verify[which];
    const targets = [item.chord, item.mid];

    function start(event) {
      verify.dragging = which;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      move(event);
    }

    function move(event) {
      if (verify.dragging !== which) return;
      const p = svgPoint(verify.svg, event);
      if (!p) return;

      const next = pointToChordState(p, verify.center, verify.radius);
      item.distanceInput.value = String(Math.round(next.distance));
      item.angleInput.value = String(next.angle);
      renderVerify();
    }

    function end(event) {
      if (verify.dragging === which) verify.dragging = null;
      try {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      } catch (_) {}
    }

    targets.forEach((target) => {
      target.addEventListener("pointerdown", start);
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", end);
      target.addEventListener("pointercancel", end);
    });
  }

  bindChordDrag("a");
  bindChordDrag("b");

  $("#verifyRandom").addEventListener("click", () => {
    verify.a.distanceInput.value = String(Math.floor(Math.random() * 145));
    verify.b.distanceInput.value = String(Math.floor(Math.random() * 145));
    verify.a.angleInput.value = String(Math.floor(Math.random() * 360));
    verify.b.angleInput.value = String(Math.floor(Math.random() * 360));
    renderVerify();
  });

  $("#missionSameDistance").addEventListener("click", () => {
    const target = Math.floor(20 + Math.random() * 105);
    verify.a.distanceInput.value = String(target);
    verify.b.distanceInput.value = String(Math.max(0, Math.min(150, target + 28)));
    verify.a.angleInput.value = String(Math.floor(Math.random() * 360));
    verify.b.angleInput.value = String(Math.floor(Math.random() * 360));
    renderVerify();

    $("#missionMessage").textContent =
      `미션: 현 A의 중심 거리 ${target}에 현 B의 거리를 맞춰 보세요. 방향은 서로 달라도 됩니다.`;
  });

  $("#missionSameLength").addEventListener("click", () => {
    const target = Math.floor(25 + Math.random() * 100);
    verify.a.distanceInput.value = String(target);
    verify.b.distanceInput.value = String(Math.max(0, Math.min(150, target + 35)));
    verify.a.angleInput.value = String(Math.floor(Math.random() * 360));
    verify.b.angleInput.value = String(Math.floor(Math.random() * 360));
    renderVerify();

    const targetLength = getVerifyState("a").length;
    $("#missionMessage").textContent =
      `미션: 현 B의 길이를 현 A(${targetLength.toFixed(1)})와 같게 만들어 보세요. 숫자를 보며 맞춘 뒤 두 중심 거리를 비교하세요.`;
  });

  renderVerify();

  // -----------------------------
  // 4. Proof
  // -----------------------------
  $("#checkProof").addEventListener("click", () => {
    const p1 = $("#proof1").value;
    const p2 = $("#proof2").value;
    const p3 = $("#proof3").value;
    const message = $("#proofMessage");

    if (!p1 || !p2 || !p3) {
      message.className = "status warn";
      message.textContent = "아직 선택하지 않은 근거가 있습니다.";
      return;
    }

    const isCorrect =
      p1 === "radius" &&
      p2 === "congruence" &&
      p3 === "bisect";

    if (isCorrect) {
      message.className = "status success";
      message.textContent =
        "증명 흐름이 연결되었습니다. 이제 각 단계에서 ‘왜?’에 답하며 자신의 문장으로 설명해 보세요.";
    } else {
      message.className = "status warn";
      message.textContent =
        "논리 연결 중 하나가 맞지 않습니다. 각 문장 앞에 ‘왜?’를 붙여 다시 근거를 확인해 보세요.";
    }
  });
})();
