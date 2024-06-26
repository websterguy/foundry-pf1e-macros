// Creates a gestalt class from 2 chosen pf1 classes, puts the class in your world items tab
const classPack = game.packs.get('pf1.classes');

const classes = classPack.index.map(o => {return {id: o._id, name: o.name}}).sort((a,b) => {return (b.name < a.name ? 1 : b.name > a.name ? -1 : 0)});

const classSelector1 = `<select id="class1">${classes.map(o => `<option value='${o.id}'>${o.name}</option>`)}</select>`
const classSelector2 = `<select id="class2">${classes.map(o => `<option value='${o.id}'>${o.name}</option>`)}</select>`

let d = new Dialog({
    title: "Gestalt Generator",
    content: `<div><label for="class1">Class 1: </label>${classSelector1}<br><label for="class2">Class 2: </label>${classSelector2}</div>`,
    buttons: {
        ok: {
            label: "Ok",
            callback: async html => {
                let choice1 = html.find('#class1')[0].value;
                let choice2 = html.find('#class2')[0].value;
                const class1 = duplicate(await classPack.getDocument(choice1));
                const class2 = duplicate(await classPack.getDocument(choice2));

                //SETS ICON
                class1.img = "systems/pf1/icons/feats/improved-feint.jpg";

                class1.name = class1.name + '/' + class2.name,
                class1.system.hd = Math.max(class1.system.hd, class2.system.hd);
                class1.system.bab = (class1.bab === 'high' || class2.bab === 'high') ? 'high' : class2.bab === 'med'? 'med' : class1.bab;
                class1.system.skillsPerLevel = Math.max(class1.system.skillsPerLevel, class2.system.skillsPerLevel);
                class1.system.weaponProf.value = class1.system.weaponProf.value.concat(class2.system.weaponProf.value.filter(o => !class1.system.weaponProf.value.includes(o)));
                class1.system.armorProf.value = class1.system.armorProf.value.concat(class2.system.armorProf.value.filter(o => !class1.system.armorProf.value.includes(o)));
                class1.system.weaponProf.custom.push(...class2.system.weaponProf.custom.filter(o => !class1.system.weaponProf.custom.includes(o)));
                console.log(class1.system.weaponProf.custom);
                class1.system.weaponProf.custom = class1.system.weaponProf.custom.toSorted();
                console.log(class1.system.weaponProf.custom);
                class1.system.armorProf.custom.push(...class2.system.armorProf.custom.filter(o => !class1.system.armorProf.custom.includes(o)));
                class1.system.armorProf.custom = class1.system.armorProf.custom.toSorted();
                class1.system.savingThrows.fort = {
                    value: (class1.system.savingThrows.fort.value === 'high' || class2.system.savingThrows.fort.value === 'high') ? 'high': class1.system.savingThrows.fort.value === 'low' ? 'low' : class2.system.savingThrows.fort.value};
                class1.system.savingThrows.ref = {
                    value: (class1.system.savingThrows.ref.value === 'high' || class2.system.savingThrows.ref.value === 'high') ? 'high': class1.system.savingThrows.ref.value === 'low' ? 'low' : class2.system.savingThrows.ref.value};
                class1.system.savingThrows.will = {
                    value: (class1.system.savingThrows.will.value === 'high' || class2.system.savingThrows.will.value === 'high') ? 'high': class1.system.savingThrows.will.value === 'low' ? 'low' : class2.system.savingThrows.will.value};
                Object.keys(class2.system.classSkills).forEach(s => class1.system.classSkills[s] = class1.system.classSkills[s] || class2.system.classSkills[s]);
                class1.system.tag = class1.system.tag + class2.system.tag.charAt(0).toUpperCase() + class2.system.tag.slice(1);
                class1.system.description.value = `<h1>${class1.name}</h1>${class1.system.description.value}<h1>${class2.name}</h1>${class2.system.description.value}`;
                class1.system.links.classAssociations = class1.system.links.classAssociations.concat(class2.system.links.classAssociations);
                Item.create(class1);
            }
        }
    }
}).render(true);
