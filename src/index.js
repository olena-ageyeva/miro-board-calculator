import { libraryIcon, toolbarIcon } from "./constants.js";



let frameId;
const path = window.location.pathname.replace("/index.html", "");
// let the sidebar now what frame was previously selected

const init = async () => {
    const queryParams = frameId ? `?frameId=${frameId}` : "";

    miro.board.ui.on('icon:click', async () => {
        await miro.board.ui.openPanel({ url: `sidebar.html${queryParams}` }, { width: "280px" });
    });    
}

init();

miro.board.events.on('FRAMEID', async (data) => {
    frameId = data;
    await miro.board.notifications.showInfo(data);
});