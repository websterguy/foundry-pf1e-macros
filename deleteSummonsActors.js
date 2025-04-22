const config = {
    folderName: "Summons" // match actor folder where summons are created
};


let folder = game.folders.find(o => o.type === "Actor" && o.name === config.folderName);

if (!game.user.isGM) ui.notifications.warn("User is not GM. Please run macro as GM.");
else if (!folder) ui.notifications.warn('No actors folder named "' + config.folderName + '". Please check config.');
else {
    deleteFolderContents(folder);
}

async function deleteFolderContents(folder) {
    while (folder.contents.length > 0) {
        await folder.contents[0].delete();
    }
}
