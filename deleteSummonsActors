const config = {
    folderName: "Summons" // match actor folder where summons are created
};

let folder = game.folders.find(o => o.type === "Actor" && o.name === config.folderName);

while (folder.content.length > 0) {
    await folder.content[0].delete();
}
