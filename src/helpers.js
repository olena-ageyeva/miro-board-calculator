import { boardStatusIcons, boardStatusMessages } from "./constants.js";

let frameID = '';

export const isWithinColumn = (item, parent) =>
  item.x - item.width / 2 >= parent.x - parent.width / 2 &&
  item.x + item.width / 2 <= parent.x + parent.width / 2;

export const isWithinRow = (item, parent) =>
  item.y - item.height / 2 >= parent.y - parent.height / 2 &&
  item.y + item.height / 2 <= parent.y + parent.height / 2;

export const isWithinCell = (item, parent) =>
  isWithinColumn(item, parent) && isWithinRow(item, parent);

export const isRoughlyWithinColumn = (item, parent) => {
  if (isWithinColumn(item, parent)) {
    return true;
  }

  const itemCenter = item.width / 2;
  const itemLeft = item.x - item.width / 2;
  const itemRight = item.x + item.width / 2;

  const parentLeft = parent.x - parent.width / 2;
  const parentRight = parent.x + parent.width / 2;


  // case when the item is almost inside the parent from the left side: [ |    ] |
  // where: [ ] - item, | | - parent
  if (
    itemLeft <= parentLeft &&
    itemRight >= parentLeft &&
    itemRight <= parentRight
  ) {
    return itemRight - parentLeft >= itemCenter;
  }

  // case when the item is almost inside the parent from the right side: | [    | ]
  // where: [ ] - item, | | - parent
  if (
    itemLeft >= parentLeft &&
    itemLeft <= parentRight &&
    itemRight >= parentRight
  ) {
    return parentRight - itemLeft >= itemCenter;
  }

  return false;
};

export const isRoughlyWithinRow = (item, parent) => {
  if (isWithinRow(item, parent)) {
    return true;
  }

  const itemCenter = item.height / 2;
  const itemTop = item.y - item.height / 2;
  const itemBottom = item.y + item.height / 2;

  const parentTop = parent.y - parent.height / 2;
  const parentBottom = parent.y + parent.height / 2;


  // case when the item is almost inside the parent from the top side
  if (
    itemTop <= parentTop &&
    itemBottom >= parentTop &&
    itemBottom <= parentBottom
  ) {
    return itemBottom - parentTop >= itemCenter;
  }

  // case when the item is almost inside the parent from the bottom side
  if (
    itemBottom >= parentBottom &&
    itemTop <= parentBottom &&
    itemTop >= parentTop
  ) {
    return parentBottom - itemTop >= itemCenter;
  }

  return false;
};

export const parseQuery = (query) =>
  query
    .slice(1)
    .split("&")
    .reduce((acc, param) => {
      const [key, value] = param.split("=");
      return { ...acc, [key]: decodeURIComponent(value) };
    }, {});

export const countStickersPoints = (stickers) =>
  stickers.reduce((acc, sticker) => {
    const points = Number(
      sticker.content.match(/(?<points>\d+)pt/)?.groups.points ?? 0,
    );

    return acc + points;
  }, 0);

export const updateStatus = async (newStatus) => {
  const statusIcon = document.getElementById("board-status-icon");
  const statusMessage = document.getElementById("board-status-message");

  statusIcon.src = boardStatusIcons[newStatus];
  statusMessage.textContent = boardStatusMessages[newStatus];
};

export const createBoardStats = async (iterationStats = {}) => {
  if (!window.frame) {
    return;
  }

  const boardStatsElement = document.getElementById("board-stats");

  if (boardStatsElement.classList.contains("hidden")) {
    boardStatsElement.classList.remove("hidden");
  }

  const iterationTableElement = document.getElementById("iteration-table");

  iterationTableElement.innerHTML = "";

  Object.entries(iterationStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([iterationName, iteration]) => {
      const rowElement = document.createElement("tr");

      const nameElement = document.createElement("td");
      nameElement.textContent = iterationName;

      const velocityElement = document.createElement("td");
      velocityElement.textContent = iteration.velocity.toString();

      const loadElement = document.createElement("td");
      loadElement.textContent = iteration.load.toString();

      const diffElement = document.createElement("td");
      diffElement.textContent = iteration.diff.toString();

      if (iteration.load > iteration.velocity) {
        rowElement.style.color = "#f00";
      }

      rowElement.appendChild(nameElement);
      rowElement.appendChild(velocityElement);
      rowElement.appendChild(loadElement);
      rowElement.appendChild(diffElement);

      iterationTableElement.appendChild(rowElement);
    });
};

export const createBoardFrameSelectOptions = async () => {
  const select = document.getElementById("frame-select");
  const items = await miro.board.get()
  const frames = items.filter(item => item.type === 'frame');

  frames.forEach((frame) => {
    select.options[select.options.length] = new Option(frame.title, frame.id);
  });

  select.addEventListener("change", async (ev) => {
    const frameId = ev.target.value;
    frameID = frameId;

    window.frame = frames.filter(item => item.id === frameId)[0];
    const recalculateButton = document.getElementById("recalculate-button");
    const exportButton = document.getElementById("export-button");

    if (recalculateButton.disabled) {
      recalculateButton.disabled = false;
    }
    if (exportButton.disabled) {
      exportButton.disabled = false;
    }

    await updateStatus("unknown");
    const broadcasted = await miro.board.events.broadcast('FRAMEID', frameId);
    console.log("broadcasted**************", frameId, broadcasted)
  });
};


export const getBoardData = async (frameId = frameID) => {
  const items = await miro.board.get()
  const stickers = items.filter(item => item.type === "sticky_note").filter(
    (item) => item.parentId === frameId
  )

  const shapes = items.filter(item => item.type === "shape")

  const iterations = shapes.filter((item) =>
    item.parentId === frameId)
    .filter((shape) => /Vel: \d+/i.test(shape.content));

  const features = shapes.filter((item) =>
    item.parentId === frameId)
    .filter((shape) => /size: \d+/i.test(shape.content));

  return {
    stickers,
    iterations,
    features,
  };
};

export const handleRecalculate = async (frameId = frameID) => {
  if (!window.frame) {
    return;
  }

  const { stickers, iterations, features } = await getBoardData(frameId);

  // count iteration loads
  await Promise.all(
    iterations.map(async (iteration) => {
      const stickersWithin = stickers.filter(
        (item) => item !== iteration && isRoughlyWithinColumn(item, iteration),
      );

      const load = countStickersPoints(stickersWithin);

      const velocity = Number(
        iteration.content.match(/vel: (?<vel>\d+)/i)?.groups.vel ?? 0,
      );

      iteration.content = iteration.content.replace(/(ld: \d+)/i, `LD: ${load}`);
      if (load > velocity) {
        iteration.style.fillColor = "#ff0000";
      } else {
        iteration.style.fillColor = "#414bb2";
        iteration.style.color = "#ffffff";
      }

      await iteration.sync()

    }),
  );

  // count feature sizes
  await Promise.all(
    features.map(async (feature) => {
      const stickersWithin = stickers.filter(
        (item) => item !== feature && isRoughlyWithinRow(item, feature),
      );

      const count = countStickersPoints(stickersWithin);

      feature.content = feature.content.replace(/(size: \d+)/i, `Size: ${count}`);

      await feature.sync()

    }),
  );

  await updateStatus("ok");
};

export const handleValidate = async (frameId = frameID) => {
  if (!window.frame) {
    return;
  }

  const { stickers, iterations, features } = await getBoardData(frameId);

  const iterationStats = {};
  // count iteration loads
  const isIterationsValid = iterations.reduce((acc, iteration) => {
    const stickersWithin = stickers.filter(
      (item) => item !== iteration && isRoughlyWithinColumn(item, iteration),
    );

    const actualLoad = countStickersPoints(stickersWithin);

    const iterationName =
      iteration.content.match(/(?<name>I\d\.\d)/i)?.groups.name;

    const iterationVelocity = Number(
      iteration.content.match(/vel: (?<count>\d+)/i)?.groups.count ?? 0,
    );
    const iterationLoad = Number(
      iteration.content.match(/ld: (?<count>\d+)/i)?.groups.count ?? 0,
    );

    const iterationDiff = Math.abs(iterationVelocity - actualLoad);

    if (iterationName) {
      iterationStats[iterationName] = {
        velocity: iterationVelocity,
        load: actualLoad,
        diff: iterationDiff,
      };
    }

    return acc && actualLoad === iterationLoad;
  }, true);

  // count feature sizes
  const isFeaturesValid = features.every((feature) => {
    const stickersWithin = stickers.filter(
      (item) => item !== feature && isRoughlyWithinRow(item, feature),
    );

    const count = countStickersPoints(stickersWithin);

    const featureCount = Number(
      feature.content.match(/size: (?<count>\d+)/i)?.groups.count ?? 0,
    );

    return count === featureCount;
  });

  if (isIterationsValid && isFeaturesValid) {
    await updateStatus("ok");
  } else {
    await updateStatus("fail");
  }

  await createBoardStats(iterationStats);
};

export const createAndDownloadCSV = async (frameId = frameID) => {
  if (!window.frame) {
    return;
  }

  const headers = ["Display Color", "Name", "Unified Parent", "Plan Estimate"];

  const { stickers, iterations, features } = await getBoardData(frameId);

  const rows = [];

  // really complicated nested loop, sorry :(
  for (const feature of features) {
    const featureStickers = stickers.filter(
      (item) => item !== feature && isRoughlyWithinRow(item, feature),
    );

    for (const sticker of featureStickers) {
      for (const iteration of iterations) {
        const isStickerInIteration = isRoughlyWithinColumn(sticker, iteration);

        if (!isStickerInIteration) {
          continue;
        }

        const iterationName =
          iteration.content.match(/(?<name>I\d\.\d)/i)?.groups.name ?? "";
        const stickerText = sticker.content ?? "Unknown text";

        const displayColor = feature.style?.backgroundColor ?? "#808080";

        const name = `${iterationName} ${stickerText.replace(
          /(\d+pt)/,
          "",
        )}`.trim();

        const unifiedParent =
          feature.content.match(/(?<feat>F\d+)/i)?.groups.feat ?? "";

        const planEstimate =
          sticker.content.match(/(?<points>\d+)pt/)?.groups.points ?? "";

        if (!planEstimate || !unifiedParent) {
          continue;
        }

        const row = [displayColor, name, unifiedParent, planEstimate];

        rows.push(row);
      }
    }
  }

  const csvData = `data:text/csv;base64,${btoa(
    [headers, ...rows].map((row) => row.join(",")).join("\n"),
  )}`;

  const encodedUri = encodeURI(csvData);

  const linkElement = document.createElement("a");
  linkElement.setAttribute("href", encodedUri);
  linkElement.setAttribute(
    "download",
    `${window.frame.title ?? "Board data"}.csv`,
  );

  linkElement.click();

  const exportWarning = document.getElementById("export-warning");
  exportWarning.classList.remove("hidden");
};
