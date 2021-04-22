/**
 * Provides simple menu for Arcanists to remove a prepared spell slot to recharge their Arcane Reservoir as per the Consume Spells (Su) ability.
 * 
 * Caster must have a spellbook linked to the Arcanist class that is set up as spontaneous (The general concensus in the current PF1e system on
 * Foundry is to set up an Arcanist as a spontaneous caster with casts per day equal to their prepared slots per day and keep track of their own number
 * of actually prepared spells using the gear "prepared" button
 **/

// CONFIGURATION
// Leave the actorName string empty to guess the players
// Example actorNames: `actorNames: "Bob",
// If using for a class with a different name or class feature, change Arcanist or Arcane Reservoir
const c = {
  actorName: "",
  arcanistClassName: "Arcanist",
  arcanistPoolName: "Arcane Reservoir",
};
// END CONFIGURATION

// Find the actor
const tokens = canvas.tokens.controlled;
let actors = tokens.map(o => o.actor);
if (!actors.length && c.actorName) actors = game.actors.entities.filter(o => c.actorName === (o.name));
if (!actors.length && game.user.character) actors = game.actors.entities.filter(o => o.hasPlayerOwner && o.hasPerm(game.user, "OWNER") && o.name === game.user.character.name);
actors = actors.filter(o => o.hasPerm(game.user, "OWNER"));

let arcanePool, arcaneMax, arcaneValue;

// Must have 1 actor
if (!actors.length) ui.notifications.warn("No applicable actor found");
else if (actors.length > 1) ui.notifications.warn("Please choose one actor");
else {
    // Check for spellbooks
    actor = actors[0];
    let activeBooks = actor.data.data.attributes.spells.usedSpellbooks;
    let arcanistBooks = Object.values(actor.data.data.attributes.spells.spellbooks).filter(o => activeBooks.includes(o.name.toLowerCase()) && o.class === c.arcanistClassName.toLowerCase() && o.spontaneous);
    arcanePool = actor.items.find(o => o.data.name === c.arcanistPoolName);
    arcaneMax = arcanePool?.data.data.uses.max;
    arcaneValue = arcanePool?.data.data.uses.value;
    if (!activeBooks.length) ui.notifications.warn(`${actor.data.name} does not have any spellbooks active`);
    else if (!arcanePool) ui.notifications.warn(`${actor.data.name} does not have a feature named ${c.arcanistPoolName}`);
    else if (!arcaneMax) ui.notifications.warn(`${c.arcanistPoolName} is not a feature with charges`);
    else if (arcaneMax <= arcaneValue) ui.notifications.warn(`${c.arcanistPoolName} is is already at maximum charges`);
    else if (!arcanistBooks.length) ui.notifications.warn(`${actor.data.name} does not have any ${c.arcanistClassName} spellbooks or the book is not set as spontaneous.`);
    else {
        // Build spellbook options
        let bookOptions = arcanistBooks.map((o) => `<option value="${o.name}">${o.class} (${o.name})</option>`);
        if (!bookOptions.length) ui.notifications.warn("No valid spellbooks available");
        else {
            
            // Build spell level options
            let levelOptions = populateLevels(null, arcanistBooks[0].name);
            let form = `
                <form class="flexcol">
                    <div class="form-group">
                        <label>Caster:</label>
                        <p>${actor.name}</p>
                    </div>
                    <div class="form-group">
                        <label>Current Pool:</label>
                        <p>${arcaneValue} / ${arcaneMax} (-${arcaneMax - arcaneValue})</p>
                    </div>
                    <div class="form-group">
                        <label>Spellbook:</label>
                        <select id="classSelect" style="text-transform: capitalize">${bookOptions}</select>
                    </div>
                    <div class="form-group">
                        <label>Spell Level to Use:</label>
                        <select id="slotSelect">${levelOptions}</select>
                    </div>
                </form>
            `;
            
            // Display UI
            const dialog = new Dialog({
              title: "Spontaneous Casting",
              content: form,
              buttons: {
                use: {
                  icon: '<i class="fas fa-dice-d20"></i>',
                  label: "Recharge",
                  callback: useSlot
                }
              },
              render: (htm) => {
                htm.find('#classSelect').change(populateLevels.bind(this, htm, null));
              },
            }).render(true);
        }
    }
    
}

/**
 * Removes one use of the prepared spell and casts the spontaneous spell
 * Outputs a chat card of the used and replacement spells
 **/
async function useSlot(htm, event) { 
    // Get the info about the spells
    let usedBook = htm.find('#classSelect')[0].value.toLowerCase();
    let usedLevel = htm.find('#slotSelect')[0].value;
    let usedSlot = "spell" + usedLevel;
    
    // Update used spell preparations
    let newSpellUses = actor.data.data.spells[usedBook].spells[usedSlot].value - 1;
    let dataLocation = "data.attributes.spells.spellbooks." + usedBook + ".spells." + usedSlot + ".value";
    let updateData = {};
    updateData[dataLocation] = newSpellUses;
    await actor.update(updateData);
    
    // Update arcane pool
    let newArcaneCharges = arcaneValue + parseInt(usedLevel) > arcaneMax ? arcaneMax : arcaneValue + parseInt(usedLevel);
    await actor.items.getName(c.arcanistPoolName).update({"data.uses.value": newArcaneCharges});
    
    // Build chat card and display
    let msg = `<div class="pf1 chat-card">
                    <header class="card-header flexrow">
                        <h3 class="actor-name">Spontaneous Replacement</h3>
                    </header>
                    <div class="result-text">
                        <p>${actor.name} loses level ${usedLevel} preparation to recharge Arcane Pool (now ${newArcaneCharges}/${arcaneMax}).</p>
                    </div>
                </div>`;
                
    ChatMessage.create({
        content: msg
    });
}

/**
 * Populates the prepared options select element with options
 * 
 **/
function populateLevels(htm, spellbook, event = null) {
    // Either get the spellbook info from the form or from the passed name
    let selectedBook = !spellbook ? htm.find('#classSelect')[0].value : spellbook;
    
    // Get the currently prepared spells in the book, ordered highest level to lowest
    let spellbookData = actor.data.data.spells[selectedBook.toLowerCase()];
    let availableLevels = [];
    
    for (var i = 9; i > 0; i--) {
        let spellLevelData = spellbookData.spells["spell" + i];
        if (spellLevelData.max > 0 && spellLevelData.value > 0) availableLevels.push({"level": i, "usesLeft": spellLevelData.value});
[i]
    }
    
    // Build the options, if any
    let slotOptions = "";
    if (availableLevels.length) {
        slotOptions = availableLevels.map(o => `<option value="${o.level}">${o.level} (${o.usesLeft} remaining)</option>`);
    }
    else slotOptions = "<option>No Spell Uses Available</option>";
    
    // If called from the form, update the form
    if (htm) {
        htm.find('#slotSelect')[0].innerHTML = slotOptions;
    }
    
    // For initial form building
    return slotOptions;
}
