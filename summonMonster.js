/**
 * Allows any user with permission to create new actors to import one from a compendium
 * If that user also has permission to create tokens, will create the specified amount in a stack on top of their current token
 * Gives ownership of the summoned tokens to the summoner
 * 
 * If Turn Alert module is enabled and there is a current combat, will place an alert for when the summons expire
 * 
 * GM users must select a token to act as the summoner
 * Player users must have their character configured under player configuration (linked to their user in the bottom left list of connected/disconnected users)
 * The above can be disabled in config to allow players users to use any owned token as the summoner, but they must select a token
 *
 * Uses standard Pathfinder 1e summon monster/nature's ally rules
 * (1 round/CL, close range, extend metamagic doubles duration, reach metamagic is medium range)
 * 
 **/
const config = {
    packSource: ["pf1"], // list of package sources for summons actor folders
    ignoreCompendiums: [""],
    destinationFolder: "Summons", // Folder to file summons in when imported. Will be auto-created by GM users, but not players
    renameAugmented: true, // Appends "(Augmented)" to the token if augmented"
    useUserLinkedActorOnly: true // Change to false to allow users to use any selected token they own as the summoner
}


// Check for Turn Alert module
const turnAlertActive = game.modules.has("turnAlert");

// Build options for folders to summon from
let packOptions = `<option value=""></option>` + game.packs.filter(p => p.entity === "Actor" && config.packSource.includes(p.metadata.package) && !config.ignoreCompendiums.includes(p.metadata.label)).map(p => `<option value="${p.collection}">${p.title}</option>`);

let summonerActor;
let summonerToken;
let classArray = [];

// Get actor and token info
if (game.user.isGM || !config.useUserLinkedActorOnly) {
    // GMs must have a token selected
    let selectedTokens = canvas.tokens.controlled;
    if (!selectedTokens.length) ui.notifications.warn("No token chosen as summoner.");
    else {
        summonerToken = selectedTokens[0];
        summonerActor = summonerToken.actor;
    }
}
else {
    // Non GMs must have a character and a token for that character on the map
    summonerActor = game.user.character;
    if (!summonerActor) ui.notifications.warn("No token chosen as summoner.");
    else {
        summonerToken = canvas.tokens.ownedTokens.filter(o => o.data.actorId === summonerActor.data._id)[0];
        if (!summonerToken) ui.notifications.warn(`No token of summoner ${summonerActor.name} available.`);
    }
}

if (summonerActor && summonerToken) {
    // Build list of character's classes sorted by level (high to low)
    classArray = Object.values(summonerActor.data.data.classes).sort(function(a, b) {return b.level - a.level});
    let classOptions = classArray.map((p, index) => `<option value="${index}">${p.name} (Level ${p.level})</option>`);
    
    let ownerCheck = "";
    if (game.user.isGM && summonerActor.hasPlayerOwner) ownerCheck = `<div class="form-group"><label>Give Ownership to ${summonerActor.name}'s Owners:</label><input type="checkbox" id="ownerCheck"></div>`;
    
    // Build UI
    const form = `
        <form class="flexcol">
            <div class="form-group">
                <label>Summoner:</label>
                <p>${summonerActor.name}</p>
            </div>
            <div class="form-group">
                <label>CL Class:</label>
                <select id="classSelect">${classOptions}</select>
            </div>
            <div class="form-group">
                <label>CL Override:</label>
                <input type="number" id="clOverride" placeholder="CL (e.g. for scrolls)">
            </div>
            <div class="form-group">
                <label>Summon From:</label>
                <select id="sourceSelect">
                    ${packOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Summon:</label>
                <select id="monsterSelect">
                </select>
            </div>
            <div class="form-group">
                <label>Number to Summon:</label>
                <input type="text" id="summonCount" placeholder="e.g. 1, 1d4+1">
            </div>
            <div class="form-group">
                <label>Augment Summoning:</label>
                <input type="checkbox" id="augmentCheck">
            </div>
            <div class="form-group">
                <label>Extend (Metamagic):</label>
                <input type="checkbox" id="extendCheck">
            </div>
            <div class="form-group">
                <label>Reach (Metamagic):</label>
                <input type="checkbox" id="reachCheck">
            </div>
            ${ownerCheck}
        </form>
    `;
    
    // Display UI
    const dialog = new Dialog({
      title: "Summon Monster",
      content: form,
      buttons: {
        use: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: "Summon",
          callback: importMonster
        }
      },
      render: (htm) => {
        htm.find('#sourceSelect').change(populateMonster.bind(this, htm));
      },
    }).render(true);
}

/**
 * On change of source dropdown, populate summon options from the chosen folder
 **/
async function populateMonster(htm, event) {
    // Get the chosen folder
    let selectedPack = event.target.value;
    let monsterSelect = htm.find("#monsterSelect")[0];
    
    // Populate the options or leave blank if no target chosen
    let monsterOptions = "";
    if (selectedPack) {
        let monsterList = await game.packs.get(selectedPack).getIndex();
        monsterOptions = monsterList.map(p => `<option value="${p._id}">${p.name}</option>`);
    }
    
    // Replace options
    monsterSelect.innerHTML = monsterOptions;
}

/**
 * Imports the selected monster into the game world, sorts it into the desired folder (if any),
 * spawns the desired number of tokens on top of the summoner's token, creates a chat message giving
 * details about the summon that occured, and creates a Turn Alert alert for when the summon ends (if
 * there is currently combat and Turn Alert is enabled)
 **/
async function importMonster(html) {
    // Get the details of the selected summon
    let selectedPack = html.find("#sourceSelect")[0].value;
    let selectedMonster = html.find("#monsterSelect")[0].value;
    
    // Gets info about the destination folder, creates it if it does not exist
    let folderID = "";
    
    if (config.destinationFolder) {
        let summonFolder = game.folders.getName(config.destinationFolder);
        
        if (summonFolder === null) {
            let folder = await Folder.create({name: config.destinationFolder, type: "Actor", parent: null});
            folderID = folder._id;
        }
        else {
            folderID = summonFolder._id;
        }
    }
    
    // Import the monster from the compendium
    let monsterEntity = game.packs.get(selectedPack).getEntity(selectedMonster);
    let createdMonster;
    await Promise.resolve(monsterEntity).then(async function(value){
        createdMonster = await Actor.create(value);
    })
    
    // Update the actor permissions
    let currentPermission = createdMonster.data.permission;
    let updatedPermission = currentPermission[game.userId] = 3;
    if (game.user.isGM) {
        let giveOwnerCheck = html.find('#ownerCheck')[0].checked;
        if (giveOwnerCheck) updatedPermission = summonerActor.data.permission;
    }
    await createdMonster.update({"folder": folderID, "permission": updatedPermission});
    
    // Get info about summon count
    let countFormula = html.find("#summonCount").val();
    let roll;
    let rollResult = 0;
    let rollHtml = "";
    
    // Verify summon count formula is valid and will result in at least 1 summon
    if (!Roll.validate(countFormula) || (new Roll(countFormula).evaluate({minimize: true}).total <= 0)) {
        ui.notifications.error(`${countFormula} not a valid roll formula. Defaulting to 1.`);
        countFormula = "1";
    }
    
    // Calculate the roll
    roll = new Roll(countFormula).roll();
    rollResult = roll.total;
    
    // Find chosen caster level info
    let chosenIndex = parseInt(html.find("#classSelect").val())
    let classCL = classArray[chosenIndex].level;
    let casterLevel = classCL;
    let clOverride = parseInt(html.find("#clOverride").val());
    
    // Validate caster level override is a number > 0
    if (!isNaN(clOverride)) {
        if (clOverride <= 0) ui.notifications.error(`${clOverride} not a valid caster level. Defaulting to class level.`);
        else casterLevel = clOverride;
    }
    
    //Set up buff for augment
    let buffData = null;
    if (html.find("#augmentCheck")[0].checked) {
        buffData = { type: "buff", name: "Augment Summoning", data: { buffType: "temp" } };
    }
    
    // Set up range as close or medium based on caster level and range metamagic
    let range = 0;
    if (html.find("#reachCheck")[0].checked) range = (100 + (casterLevel * 10));
    else range = (25 + (Math.floor(casterLevel / 2) * 5));
    
    // Double caster level for extend metamagic
    if (html.find("#extendCheck")[0].checked) casterLevel *= 2;
    
    // Create desired number of tokens and place them on top of the summoner token
    canvas.tokens.releaseAll();
    let tokenCreated;
    for (let i = 0; i < rollResult; i++) {
        let tokenForId = await canvas.tokens.createMany(createdMonster.data.token, {temporary: true});
        tokenForId.x = summonerToken.data.x;
        tokenForId.y = summonerToken.data.y;
        tokenCreated = await canvas.tokens.createMany(tokenForId);
        if (buffData) {
            tokenCreated = canvas.tokens.get(tokenCreated._id);
            await tokenCreated.actor.createOwnedItem(buffData);
            let buff = tokenCreated.actor.items.find(o => o.name === "Augment Summoning" && o.type === "buff");
            let changes = [];
            changes.push({formula: "4", priority: 1, target: "ability", subTarget: "str", modifier: "enh"});
            changes.push({formula: "4", priority: 1, target: "ability", subTarget: "dex", modifier: "enh"});
            await buff.update({"data.changes": changes});
            await buff.update({"data.active": true});
            let actorName = tokenCreated.name + " (Augmented)";
            await tokenCreated.actor.update({"name": actorName});
        }
    }
    
    // If there is a combat active and Turn Alert is enabled, create an alert at this initiative in CL rounds
    let thisCombatant = game.combat?.combatant;
    if (thisCombatant && turnAlertActive) {    
        if (casterLevel > 0) {
            const alertData = {
                round: casterLevel,
                roundAbsolute: false,
                turnId: thisCombatant._id,
                message: `${createdMonster.name} disappears.`
            }
            
            TurnAlert.create(alertData);
        }
    }
    
    // Create chat message about summon
    let msg = `<div class="pf1 chat-card">
                    <header class="card-header flexrow">
                        <h3 class="actor-name">Summoning!</h3>
                    </header>
                    <div class="result-text">
                        <p><a class="inline-roll inline-result" title="${roll.formula}"><i class="fas fa-dice-d20"></i> ${roll.total}</a> ${createdMonster.name} summoned for ${casterLevel} rounds within ${range} feet range.</p>
                    </div>
                </div>`
                
    ChatMessage.create({
        content: msg
    });
}
