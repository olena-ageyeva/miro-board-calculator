import {
    handleRecalculate,
    createBoardFrameSelectOptions,
    handleValidate,
    parseQuery,
    createAndDownloadCSV,
} from "./helpers.js";

await createBoardFrameSelectOptions();


let frameId;

miro.board.events.on('FRAMEID', async (data) => {
    frameId = data;
    await miro.board.notifications.showInfo(data);
});

const recalculateButton = document.getElementById("recalculate-button");

recalculateButton.addEventListener("click", () => handleRecalculate(frameId));

const exportButton = document.getElementById("export-button");

exportButton.addEventListener("click", createAndDownloadCSV);

setInterval(() => handleValidate(frameId), 1000);

// restore previously selected frame
if (frameId) {
    window.frame = (await miro.board.get({ id: frameId }))[0];

    const select = document.getElementById("frame-select");

    const option = Array.from(select.options).find(
        (option) => option.value === frameId,
    );

    if (option) {
        option.selected = true;
        select.dispatchEvent(new Event("change"));
    }
}

