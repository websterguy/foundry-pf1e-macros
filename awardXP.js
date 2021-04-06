// CONFIGURATION
// If there are PCs you always want to exclude from showing on the checklist to award to, enter in "ignorePCs"
// If there are NPCs that you want to ignore awarding XP for from the combat tracker, enter in "ignoreNPCs"
const c = {
  ignorePCs: [],
  ignoreNPCs: []
};
// END CONFIGURATION

canvas.tokens.selectObjects();
const tokens = canvas.tokens.controlled;
let actors = tokens.map(o => o.actor);
if (!actors.length && c.ignorePCs.length > 0) actors = game.actors.entities.filter(o => !c.ignorePCs.includes(o.name));
if (!actors.length) actors = game.actors.entities.filter(o => o.isPC);
actors = actors.filter(o => o.hasPerm(game.user, "OWNER"));

if (!actors.length) ui.notifications.warn("No applicable actor(s) found");
else {
  const _action = function(xp, checkedArray, distributed, pcCount, originalXp) {
    var targets=[];
    if (!isNaN(xp)) {
        for ( let actor of actors ) {
            for (let element of checkedArray) {
                if (element.name == actor.name){
                    targets.push(actor);
                }
            }
        }
    
        let msg = `<div class="pf1 chat-card">
                    <header class="card-header flexrow">
                        <h3 class="actor-name">${originalXp} XP Awarded</h3>
                    </header>
                    <div class="result-text">`;
        if (distributed) {
            msg += `<p style="font-size: 14px; margin: .1em 0">${originalXp} xp distributed among ${pcCount} characters (${xp} each).</p>`;
        }
        else {
            msg += `<p style="font-size: 14px; margin: .1em 0">${xp} xp each awarded to ${pcCount} characters.</p>`;
        }
        
        targets.forEach(o => {
            let curXP = getProperty(o.data, "data.details.xp.value") || 0;
            let levelXP = getProperty(o.data, "data.details.xp.max");
            if (typeof curXP === "string") curXP = parseInt(curXP);
            o.update({ "data.details.xp.value": curXP + xp });
            msg += `<p style="font-size: 14px; margin: .1em 0"><strong>${o.name}:</strong> ${curXP} xp updated to ${(curXP + xp)} (next level at ${levelXP})</p>`;
        });
        
        msg += `</div>`;
        
        ChatMessage.create({
            content: msg
        });
    }
  };
  
  let thisCombat = game.combat?.combatants;
  let npcChecklist = "";
  let hasNPCs = false;
  let npcXpTotal = 0;
  
  if (thisCombat && thisCombat.length > 0) {
      let combatNPCs = thisCombat.filter(o => !o.actor.isPC && o.actor.data.type === "npc" && !c.ignoreNPCs.includes(o.actor.name));
      hasNPCs = (combatNPCs.length > 0);
      if (hasNPCs) {
          combatNPCs.forEach(combatant => {
            npcChecklist += `
                <input type="checkbox" name="${combatant.actor.name}" value="${combatant.actor.data.data.details.xp.value}" checked class="npcXPCheckbox">\n
                <label for="${combatant.actor.name}">${combatant.actor.name} (CR ${combatant.actor.data.data.details.cr.total}, ${combatant.actor.data.data.details.xp.value} xp)</label><br>`
            npcXpTotal += combatant.actor.data.data.details.xp.value;
          });
      }
  }
  
  let checkPlayerOptions = "";
  // Build checkbox list for all active players
  actors.forEach(actor => {
    let checked = '';
    if (actor.data.type === "npc") return;
    if (actor.isPC) checked = 'checked';
    checkPlayerOptions+=`
        <br>
        <input type="checkbox" class="awardedPC" name="${actor.name}" value="${actor.name}" ${checked}>\n
        <label for="${actor.name}">${actor.name}</label>
    `
  });
  
  const msg = `
    Award XP to the following actors: ${checkPlayerOptions}
    <br>
    ${hasNPCs ? `<br>Award XP for the following: <br>${npcChecklist}` : ``}
    `;
  const field = `<input type="text" id="xpAwardValue" name="xp" value="${npcXpTotal}" placeholder="XP amount" style="margin-bottom: 8px;" />`;

  new Dialog({
    title: "Roll saving throw",
    content: `<p>${msg}</p>${field}`,
    buttons: {
      ok: {
        label: "Give All",
        callback: html => {
          let checkedArray = html.find('input[class="awardedPC"]:checked');
          let checkedCount = checkedArray.length;
          let xp = parseInt(html.find('input[name="xp"]').val());
          _action(xp, checkedArray, false, checkedCount, xp);
        },
      },
      distribute: {
        label: "Distribute",
        callback: html => {
          let checkedArray = html.find('input[class="awardedPC"]:checked');
          let checkedCount = checkedArray.length;
          let originalXp = parseInt(html.find('input[name="xp"]').val());
          let xp = Math.floor(originalXp / checkedCount);
          _action(xp, checkedArray, true, checkedCount, originalXp);
        }
      }
    },
    render: (htm) => {
          htm.find('.npcXPCheckbox').click(updateValue.bind(this, htm.find('input[name="xp"]')));
      },
  }).render(true);

  let updateValue = function(xpInput, event) {
    let checkbox = event.target;
    let xp = parseInt(xpInput.val());
    xp = checkbox.checked ? (xp + parseInt(checkbox.value)) : (xp - parseInt(checkbox.value));
    xpInput.val(xp);
  }
  
}
