const fileInput = document.querySelector("#fileInput");
const fileName = document.querySelector("#fileName");
const languageSelect = document.querySelector("#languageSelect");
const targetList = document.querySelector("#targetList");
const codeOutput = document.querySelector("#codeOutput");
const codeTitle = document.querySelector("#codeTitle");
const scriptCount = document.querySelector("#scriptCount");
const message = document.querySelector("#message");
const copyButton = document.querySelector("#copyButton");
const downloadButton = document.querySelector("#downloadButton");

let project = null;
let selectedTargetId = null;

const primitiveInputs = new Set([4, 5, 6, 7, 8, 9, 10, "math_number", "math_integer", "math_whole_number", "math_positive_number", "math_angle", "colour_picker", "text"]);

const languages = {
  python: { label: "Python", extension: "py", create: (target) => new PythonConverter(target) },
  cpp: { label: "C++", extension: "cpp", create: (target) => new CppConverter(target) },
  javascript: { label: "JavaScript", extension: "js", create: (target) => new JavaScriptConverter(target) },
  java: { label: "Java", extension: "java", create: (target) => new JavaConverter(target) },
  csharp: { label: "C#", extension: "cs", create: (target) => new CSharpConverter(target) }
};

const blockNames = {
  event_whenflagclicked: "when green flag clicked",
  event_whenkeypressed: "when key pressed",
  event_whenthisspriteclicked: "when this sprite clicked",
  event_whenbackdropswitchesto: "when backdrop switches",
  event_whenbroadcastreceived: "when broadcast received",
  event_broadcast: "broadcast",
  event_broadcastandwait: "broadcast and wait",
  motion_movesteps: "move steps",
  motion_turnright: "turn right",
  motion_turnleft: "turn left",
  motion_goto: "go to",
  motion_gotoxy: "go to x y",
  motion_glideto: "glide to",
  motion_glidesecstoxy: "glide to x y",
  motion_pointindirection: "point in direction",
  motion_pointtowards: "point towards",
  motion_changexby: "change x by",
  motion_setx: "set x",
  motion_changeyby: "change y by",
  motion_sety: "set y",
  motion_ifonedgebounce: "if on edge bounce",
  looks_sayforsecs: "say for seconds",
  looks_say: "say",
  looks_thinkforsecs: "think for seconds",
  looks_think: "think",
  looks_show: "show",
  looks_hide: "hide",
  looks_switchcostumeto: "switch costume",
  looks_nextcostume: "next costume",
  looks_switchbackdropto: "switch backdrop",
  looks_nextbackdrop: "next backdrop",
  looks_changesizeby: "change size by",
  looks_setsizeto: "set size to",
  sound_play: "start sound",
  sound_playuntildone: "play sound until done",
  sound_stopallsounds: "stop all sounds",
  sound_changeeffectby: "change sound effect by",
  sound_seteffectto: "set sound effect",
  sound_cleareffects: "clear sound effects",
  sound_changevolumeby: "change volume by",
  sound_setvolumeto: "set volume",
  control_wait: "wait",
  control_repeat: "repeat",
  control_forever: "forever",
  control_if: "if",
  control_if_else: "if else",
  control_wait_until: "wait until",
  control_repeat_until: "repeat until",
  control_stop: "stop",
  data_setvariableto: "set variable",
  data_changevariableby: "change variable",
  data_showvariable: "show variable",
  data_hidevariable: "hide variable",
  data_addtolist: "add to list",
  data_deleteoflist: "delete from list",
  data_deletealloflist: "delete all of list",
  data_insertatlist: "insert into list",
  data_replaceitemoflist: "replace list item",
  data_showlist: "show list",
  data_hidelist: "hide list"
};

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  fileName.textContent = file.name;
  clearMessage();

  try {
    const zip = await JSZip.loadAsync(file);
    const projectFile = zip.file("project.json");
    if (!projectFile) throw new Error("The .sb3 file does not contain project.json.");
    project = JSON.parse(await projectFile.async("string"));
    selectedTargetId = project.targets?.[0]?.name ?? null;
    renderTargets();
    renderCode();
    copyButton.disabled = false;
    downloadButton.disabled = false;
  } catch (error) {
    showMessage(error.message || "Could not read this Scratch file.");
  }
});

languageSelect.addEventListener("change", renderCode);
copyButton.addEventListener("click", () => navigator.clipboard.writeText(codeOutput.textContent));
downloadButton.addEventListener("click", downloadCode);

function renderTargets() {
  targetList.innerHTML = "";
  for (const target of project.targets || []) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `target-button${target.name === selectedTargetId ? " active" : ""}`;
    button.innerHTML = `<strong>${escapeHtml(target.name)}</strong><span>${target.isStage ? "Stage" : "Sprite"} · ${countTopLevelScripts(target)} scripts</span>`;
    button.addEventListener("click", () => {
      selectedTargetId = target.name;
      renderTargets();
      renderCode();
    });
    targetList.appendChild(button);
  }
}

function renderCode() {
  if (!project) return;
  const target = project.targets.find((item) => item.name === selectedTargetId) || project.targets[0];
  const language = languageSelect.value;
  const languageConfig = languages[language] || languages.python;
  const converter = languageConfig.create(target);
  const scripts = getTopLevelBlocks(target).map((blockId) => converter.convertScript(blockId)).filter(Boolean);
  codeTitle.textContent = `${target.name} (${languageConfig.label})`;
  scriptCount.textContent = `${scripts.length} script${scripts.length === 1 ? "" : "s"}`;
  codeOutput.textContent = converter.wrap(scripts.join("\n\n"));
}

function getTopLevelBlocks(target) {
  return Object.entries(target.blocks || {})
    .filter(([, block]) => block && typeof block === "object" && block.topLevel)
    .sort(([, a], [, b]) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0))
    .map(([id]) => id);
}

function countTopLevelScripts(target) {
  return getTopLevelBlocks(target).length;
}

class BaseConverter {
  constructor(target) {
    this.target = target;
    this.blocks = target.blocks || {};
    this.events = [];
  }

  convertScript(blockId) {
    const block = this.blocks[blockId];
    if (!block) return "";
    const name = this.nameForTopLevelBlock(block);
    const header = this.eventHeader(name);
    this.events.push({ opcode: block.opcode, name, key: block.fields?.KEY_OPTION?.[0] || "" });
    const body = this.convertSequence(block.next, 1);
    return [header, body || this.indent(1) + this.noop()].filter(Boolean).join("\n");
  }

  convertSequence(blockId, level) {
    const lines = [];
    let currentId = blockId;
    while (currentId) {
      const block = this.blocks[currentId];
      if (!block) break;
      lines.push(...this.statementFor(block, level));
      currentId = block.next;
    }
    return lines.join("\n");
  }

  statementFor(block, level) {
    const op = block.opcode;
    if (op === "control_repeat") {
      return this.blockWithBody(level, this.repeatHeader(this.value(block, "TIMES")), block.inputs?.SUBSTACK?.[1]);
    }
    if (op === "control_forever") {
      return this.blockWithBody(level, this.foreverHeader(), block.inputs?.SUBSTACK?.[1]);
    }
    if (op === "control_if") {
      return this.blockWithBody(level, this.ifHeader(this.value(block, "CONDITION")), block.inputs?.SUBSTACK?.[1]);
    }
    if (op === "control_if_else") {
      return this.ifElseBlock(level, block);
    }
    if (op === "control_repeat_until") {
      return this.blockWithBody(level, this.repeatUntilHeader(this.value(block, "CONDITION")), block.inputs?.SUBSTACK?.[1]);
    }
    if (op === "control_wait_until") {
      return [this.indent(level) + this.waitUntil(this.value(block, "CONDITION"))];
    }
    if (op === "procedures_call") {
      return [this.indent(level) + this.callCustomBlock(block)];
    }
    return [this.indent(level) + this.simpleStatement(block)];
  }

  blockWithBody(level, header, substackId) {
    const body = this.convertSequence(substackId, level + 1) || this.indent(level + 1) + this.noop();
    return [this.indent(level) + header, body];
  }

  ifElseBlock(level, block) {
    const lines = this.blockWithBody(level, this.ifHeader(this.value(block, "CONDITION")), block.inputs?.SUBSTACK?.[1]);
    lines.push(this.indent(level) + this.elseHeader());
    lines.push(this.convertSequence(block.inputs?.SUBSTACK2?.[1], level + 1) || this.indent(level + 1) + this.noop());
    return lines;
  }

  value(block, name) {
    return this.inputValue(block.inputs?.[name]);
  }

  inputValue(input) {
    if (!input) return this.literal("");
    const value = input[1];
    if (typeof value === "string") return this.expression(value);
    if (Array.isArray(value)) return this.primitive(value);
    return this.literal("");
  }

  expression(blockId) {
    const block = this.blocks[blockId];
    if (!block) return this.literal("");
    const op = block.opcode;
    if (op === "operator_add") return `(${this.value(block, "NUM1")} + ${this.value(block, "NUM2")})`;
    if (op === "operator_subtract") return `(${this.value(block, "NUM1")} - ${this.value(block, "NUM2")})`;
    if (op === "operator_multiply") return `(${this.value(block, "NUM1")} * ${this.value(block, "NUM2")})`;
    if (op === "operator_divide") return `(${this.value(block, "NUM1")} / ${this.value(block, "NUM2")})`;
    if (op === "operator_lt") return `(${this.value(block, "OPERAND1")} < ${this.value(block, "OPERAND2")})`;
    if (op === "operator_gt") return `(${this.value(block, "OPERAND1")} > ${this.value(block, "OPERAND2")})`;
    if (op === "operator_equals") return `(${this.value(block, "OPERAND1")} == ${this.value(block, "OPERAND2")})`;
    if (op === "operator_and") return `(${this.value(block, "OPERAND1")} ${this.andOperator()} ${this.value(block, "OPERAND2")})`;
    if (op === "operator_or") return `(${this.value(block, "OPERAND1")} ${this.orOperator()} ${this.value(block, "OPERAND2")})`;
    if (op === "operator_not") return `${this.notOperator()}(${this.value(block, "OPERAND")})`;
    if (op === "operator_join") return `${this.toString(this.value(block, "STRING1"))} + ${this.toString(this.value(block, "STRING2"))}`;
    if (op === "operator_random") return this.randomExpr(this.value(block, "FROM"), this.value(block, "TO"));
    if (op === "operator_round") return this.roundExpr(this.value(block, "NUM"));
    if (op === "operator_contains") return this.containsExpr(this.value(block, "STRING1"), this.value(block, "STRING2"));
    if (op === "data_variable") return this.identifier(block.fields?.VARIABLE?.[0] || "variable");
    if (op === "data_itemoflist") return this.listItem(this.identifier(block.fields?.LIST?.[0] || "list"), this.value(block, "INDEX"));
    if (op === "data_lengthoflist") return this.listLength(this.identifier(block.fields?.LIST?.[0] || "list"));
    if (op === "data_listcontainsitem") return this.listContains(this.identifier(block.fields?.LIST?.[0] || "list"), this.value(block, "ITEM"));
    if (op === "sensing_answer") return this.identifier("answer");
    if (op === "sensing_current") return this.currentDatePart(block.fields?.CURRENTMENU?.[0] || "second");
    if (block.fields && Object.keys(block.fields).length > 0 && !op.startsWith("operator_") && !op.startsWith("data_")) {
      return this.literal(Object.values(block.fields)[0][0]);
    }
    return this.genericExpression(block);
  }

  primitive(value) {
    const primitiveType = value[0];
    if (primitiveInputs.has(primitiveType)) return this.literal(value[1] ?? "");
    if (primitiveType === 12 || primitiveType === 13) return this.identifier(value[1] ?? "variable");
    return this.literal(value[1] ?? "");
  }

  simpleStatement(block) {
    const op = block.opcode;
    if (op === "control_wait") return this.call("wait", [this.value(block, "DURATION")]);
    if (op === "control_stop") return this.stop(block.fields?.STOP_OPTION?.[0] || "all");
    if (op === "motion_movesteps") return this.call("move_steps", [this.value(block, "STEPS")]);
    if (op === "motion_turnright") return this.call("turn_right", [this.value(block, "DEGREES")]);
    if (op === "motion_turnleft") return this.call("turn_left", [this.value(block, "DEGREES")]);
    if (op === "motion_gotoxy") return this.call("go_to_xy", [this.value(block, "X"), this.value(block, "Y")]);
    if (op === "motion_goto") return this.call("go_to", [this.fieldOrInput(block, "TO")]);
    if (op === "motion_glideto") return this.call("glide_to", [this.value(block, "SECS"), this.fieldOrInput(block, "TO")]);
    if (op === "motion_glidesecstoxy") return this.call("glide_to_xy", [this.value(block, "SECS"), this.value(block, "X"), this.value(block, "Y")]);
    if (op === "motion_pointindirection") return this.call("point_in_direction", [this.value(block, "DIRECTION")]);
    if (op === "motion_pointtowards") return this.call("point_towards", [this.fieldOrInput(block, "TOWARDS")]);
    if (op === "motion_changexby") return this.call("change_x_by", [this.value(block, "DX")]);
    if (op === "motion_setx") return this.call("set_x", [this.value(block, "X")]);
    if (op === "motion_changeyby") return this.call("change_y_by", [this.value(block, "DY")]);
    if (op === "motion_sety") return this.call("set_y", [this.value(block, "Y")]);
    if (op === "motion_ifonedgebounce") return this.call("if_on_edge_bounce", []);
    if (op === "looks_say") return this.printStatement(this.value(block, "MESSAGE"));
    if (op === "looks_sayforsecs") return this.printStatement(this.value(block, "MESSAGE"));
    if (op === "looks_think") return this.printStatement(this.value(block, "MESSAGE"));
    if (op === "looks_thinkforsecs") return this.printStatement(this.value(block, "MESSAGE"));
    if (op === "looks_show") return this.call("show", []);
    if (op === "looks_hide") return this.call("hide", []);
    if (op === "looks_switchcostumeto") return this.call("switch_costume_to", [this.value(block, "COSTUME")]);
    if (op === "looks_nextcostume") return this.call("next_costume", []);
    if (op === "looks_switchbackdropto") return this.call("switch_backdrop_to", [this.value(block, "BACKDROP")]);
    if (op === "looks_nextbackdrop") return this.call("next_backdrop", []);
    if (op === "looks_changesizeby") return this.call("change_size_by", [this.value(block, "CHANGE")]);
    if (op === "looks_setsizeto") return this.call("set_size_to", [this.value(block, "SIZE")]);
    if (op === "sound_play") return this.call("start_sound", [this.value(block, "SOUND_MENU")]);
    if (op === "sound_playuntildone") return this.call("play_sound_until_done", [this.value(block, "SOUND_MENU")]);
    if (op === "sound_stopallsounds") return this.call("stop_all_sounds", []);
    if (op === "sound_changevolumeby") return this.call("change_volume_by", [this.value(block, "VOLUME")]);
    if (op === "sound_setvolumeto") return this.call("set_volume_to", [this.value(block, "VOLUME")]);
    if (op === "event_broadcast") return this.call("broadcast", [this.value(block, "BROADCAST_INPUT")]);
    if (op === "event_broadcastandwait") return this.call("broadcast_and_wait", [this.value(block, "BROADCAST_INPUT")]);
    if (op === "sensing_askandwait") return this.assign(this.identifier("answer"), this.inputExpression(this.value(block, "QUESTION")));
    if (op === "data_setvariableto") return this.assign(this.identifier(block.fields?.VARIABLE?.[0] || "variable"), this.value(block, "VALUE"));
    if (op === "data_changevariableby") return this.increment(this.identifier(block.fields?.VARIABLE?.[0] || "variable"), this.value(block, "VALUE"));
    if (op === "data_addtolist") return this.listAppend(this.identifier(block.fields?.LIST?.[0] || "list"), this.value(block, "ITEM"));
    if (op === "data_deleteoflist") return this.listDelete(this.identifier(block.fields?.LIST?.[0] || "list"), this.value(block, "INDEX"));
    if (op === "data_deletealloflist") return this.listClear(this.identifier(block.fields?.LIST?.[0] || "list"));
    if (op === "data_insertatlist") return this.listInsert(this.identifier(block.fields?.LIST?.[0] || "list"), this.value(block, "INDEX"), this.value(block, "ITEM"));
    if (op === "data_replaceitemoflist") return this.listReplace(this.identifier(block.fields?.LIST?.[0] || "list"), this.value(block, "INDEX"), this.value(block, "ITEM"));
    return this.comment(`${blockNames[op] || op}: ${this.describeFields(block)}`.trim());
  }

  nameForTopLevelBlock(block) {
    const op = block.opcode;
    if (op === "event_whenflagclicked") return "when_green_flag_clicked";
    if (op === "event_whenkeypressed") return `when_${this.identifier(block.fields?.KEY_OPTION?.[0] || "key")}_pressed`;
    if (op === "event_whenthisspriteclicked") return "when_this_sprite_clicked";
    if (op === "event_whenbackdropswitchesto") return `when_backdrop_switches_to_${this.identifier(block.fields?.BACKDROP?.[0] || "backdrop")}`;
    if (op === "event_whenbroadcastreceived") return `when_i_receive_${this.identifier(block.fields?.BROADCAST_OPTION?.[0] || "message")}`;
    if (op === "procedures_definition") return this.customDefinitionName(block);
    return this.identifier(blockNames[op] || op);
  }

  customDefinitionName(block) {
    const prototypeId = block.inputs?.custom_block?.[1];
    const prototype = this.blocks[prototypeId];
    const name = prototype?.mutation?.proccode || "custom_block";
    return this.identifier(name.replace(/%[bs]/g, "arg"));
  }

  declarations() { return ""; }
  entryPoint() { return ""; }

  fieldOrInput(block, name) {
    if (block.inputs?.[name]) return this.value(block, name);
    return this.literal(block.fields?.[name]?.[0] || "");
  }

  callCustomBlock(block) {
    const name = this.identifier((block.mutation?.proccode || "custom_block").replace(/%[bs]/g, "arg"));
    return this.call(name, []);
  }

  genericExpression(block) {
    return this.literal(blockNames[block.opcode] || block.opcode);
  }

  describeFields(block) {
    return Object.values(block.fields || {}).map((field) => field[0]).join(", ");
  }

  identifier(name) {
    const cleaned = String(name).trim().replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
    return cleaned || "value";
  }

  indent(level) {
    return "  ".repeat(level);
  }
}

class PythonConverter extends BaseConverter {
  wrap(code) {
    return `# Converted from Scratch 3 target: ${this.target.name}\nfrom datetime import datetime\nimport random\nimport time\n\n${this.declarations()}\n\n${code || "# No scripts found."}${this.entryPoint()}`;
  }

  convertScript(blockId) {
    const code = super.convertScript(blockId);
    const names = this.globalNames();
    if (!code || names.length === 0) return code;
    const lines = code.split("\n");
    lines.splice(1, 0, this.indent(1) + `global ${names.join(", ")}`);
    return lines.join("\n");
  }

  eventHeader(name) { return `def ${name}():`; }
  repeatHeader(times) { return `for _ in range(int(${times})):`; }
  foreverHeader() { return "while True:"; }
  ifHeader(condition) { return `if ${condition}:`; }
  elseHeader() { return "else:"; }
  repeatUntilHeader(condition) { return `while not (${condition}):`; }
  waitUntil(condition) { return `while not (${condition}): wait(0.1)`; }
  noop() { return "pass"; }
  andOperator() { return "and"; }
  orOperator() { return "or"; }
  notOperator() { return "not "; }
  literal(value) { return isNumeric(value) ? String(value) : JSON.stringify(String(value)); }
  call(name, args) { return `${this.identifier(name)}(${args.join(", ")})`; }
  assign(name, value) { return `${name} = ${value}`; }
  increment(name, value) { return `${name} += ${value}`; }
  stop(option) { return option === "this script" ? "return" : `stop(${JSON.stringify(option)})`; }
  comment(text) { return `# ${text}`; }
  toString(value) { return `str(${value})`; }
  randomExpr(from, to) { return `random.randint(${from}, ${to})`; }
  roundExpr(value) { return `round(${value})`; }
  containsExpr(haystack, needle) { return `(${needle} in ${haystack})`; }
  printStatement(value) { return `print(${value})`; }
  inputExpression(prompt) { return `input(str(${prompt}) + " ")`; }
  listAppend(name, value) { return `${name}.append(${value})`; }
  listDelete(name, index) { return `del ${name}[${this.listIndex(name, index)}]`; }
  listClear(name) { return `${name}.clear()`; }
  listInsert(name, index, value) { return `${name}.insert(${this.listIndex(name, index)}, ${value})`; }
  listReplace(name, index, value) { return `${name}[${this.listIndex(name, index)}] = ${value}`; }
  listItem(name, index) { return `${name}[${this.listIndex(name, index)}]`; }
  listLength(name) { return `len(${name})`; }
  listContains(name, value) { return `(${value} in ${name})`; }
  currentDatePart(part) {
    const formats = { year: "%Y", month: "%m", date: "%d", dayofweek: "%A", hour: "%H", minute: "%M", second: "%S" };
    return `datetime.now().strftime(${JSON.stringify(formats[String(part).toLowerCase()] || "%S")})`;
  }

  declarations() {
    const lines = this.globalNames().map((name) => `${name} = ""`);
    for (const [, list] of Object.entries(this.target.lists || {})) {
      lines.push(`${this.identifier(list[0])} = ${JSON.stringify(list[1] || [])}`);
    }
    return lines.join("\n");
  }

  entryPoint() {
    const greenFlags = this.events.filter((event) => event.opcode === "event_whenflagclicked");
    const keyEvents = this.events.filter((event) => event.opcode === "event_whenkeypressed");
    const lines = ["", "", "if __name__ == \"__main__\":"];
    if (greenFlags.length === 0 && keyEvents.length === 0) return "";
    for (const event of greenFlags) lines.push(this.indent(1) + `${event.name}()`);
    if (keyEvents.length > 0) {
      lines.push(this.indent(1) + "while True:");
      lines.push(this.indent(2) + "key = input(\"Press a Scratch key (or Enter to quit): \")");
      lines.push(this.indent(2) + "if key == \"\":");
      lines.push(this.indent(3) + "break");
      keyEvents.forEach((event, index) => {
        lines.push(this.indent(2) + `${index === 0 ? "if" : "elif"} key.lower() == ${JSON.stringify(event.key.toLowerCase())}:`);
        lines.push(this.indent(3) + `${event.name}()`);
      });
    }
    return lines.join("\n");
  }

  globalNames() {
    const names = Object.values(this.target.variables || {}).map((variable) => this.identifier(variable[0]));
    if (Object.values(this.blocks).some((block) => block?.opcode === "sensing_askandwait" || block?.opcode === "sensing_answer")) names.push(this.identifier("answer"));
    return [...new Set(names)];
  }

  listIndex(name, index) {
    if (index === this.literal("last")) return "-1";
    if (index === this.literal("random")) return `random.randrange(len(${name}))`;
    return `(int(${index}) - 1)`;
  }
}

class CppConverter extends BaseConverter {
  wrap(code) {
    return `// Converted from Scratch 3 target: ${this.target.name}\n#include <algorithm>\n#include <cmath>\n#include <cstdlib>\n#include <ctime>\n#include <iostream>\n#include <sstream>\n#include <string>\n#include <vector>\n\ntemplate <typename T>\nstd::string to_text(const T& value) { std::ostringstream out; out << value; return out.str(); }\n\nint to_int(const std::string& value) { return std::stoi(value); }\nint to_int(int value) { return value; }\nint to_int(double value) { return static_cast<int>(value); }\n\nstd::string ask(const std::string& question) {\n  std::cout << question << " ";\n  std::string answer;\n  std::getline(std::cin, answer);\n  return answer;\n}\n\nstd::string current_date_part(const std::string& part) {\n  std::time_t now = std::time(nullptr);\n  std::tm* local = std::localtime(&now);\n  char buffer[32];\n  const char* format = part == "year" ? "%Y" : part == "month" ? "%m" : part == "date" ? "%d" : part == "dayofweek" ? "%A" : part == "hour" ? "%H" : part == "minute" ? "%M" : "%S";\n  std::strftime(buffer, sizeof(buffer), format, local);\n  return buffer;\n}\n\n${this.declarations()}\n\n${code || "// No scripts found."}${this.entryPoint()}`;
  }

  eventHeader(name) { return `void ${name}() {`; }
  repeatHeader(times) { return `for (int i = 0; i < to_int(${times}); ++i) {`; }
  foreverHeader() { return "while (true) {"; }
  ifHeader(condition) { return `if (${condition}) {`; }
  elseHeader() { return "} else {"; }
  repeatUntilHeader(condition) { return `while (!(${condition})) {`; }
  waitUntil(condition) { return `while (!(${condition})) { wait(0.1); }`; }
  noop() { return "// no operation"; }
  andOperator() { return "&&"; }
  orOperator() { return "||"; }
  notOperator() { return "!"; }
  literal(value) { return isNumeric(value) ? String(value) : JSON.stringify(String(value)); }
  call(name, args) { return `${this.identifier(name)}(${args.join(", ")});`; }
  assign(name, value) { return `${name} = ${value};`; }
  increment(name, value) { return `${name} += ${value};`; }
  stop(option) { return option === "this script" ? "return;" : `stop(${JSON.stringify(option)});`; }
  comment(text) { return `// ${text}`; }
  toString(value) { return `to_text(${value})`; }
  randomExpr(from, to) { return `(${from} + std::rand() % (${to} - ${from} + 1))`; }
  roundExpr(value) { return `std::round(${value})`; }
  containsExpr(haystack, needle) { return `(${haystack}.find(${needle}) != std::string::npos)`; }
  printStatement(value) { return `std::cout << ${value} << std::endl;`; }
  inputExpression(prompt) { return `ask(${prompt})`; }
  listAppend(name, value) { return `${name}.push_back(to_text(${value}));`; }
  listDelete(name, index) { return `${name}.erase(${name}.begin() + ${this.listIndex(name, index)});`; }
  listClear(name) { return `${name}.clear();`; }
  listInsert(name, index, value) { return `${name}.insert(${name}.begin() + ${this.listIndex(name, index)}, to_text(${value}));`; }
  listReplace(name, index, value) { return `${name}[${this.listIndex(name, index)}] = to_text(${value});`; }
  listItem(name, index) { return `${name}[${this.listIndex(name, index)}]`; }
  listLength(name) { return `${name}.size()`; }
  listContains(name, value) { return `(std::find(${name}.begin(), ${name}.end(), ${value}) != ${name}.end())`; }
  currentDatePart(part) { return `current_date_part(${JSON.stringify(String(part).toLowerCase())})`; }

  declarations() {
    const lines = this.globalNames().map((name) => `std::string ${name};`);
    for (const [, list] of Object.entries(this.target.lists || {})) {
      const items = (list[1] || []).map((item) => JSON.stringify(String(item))).join(", ");
      lines.push(`std::vector<std::string> ${this.identifier(list[0])} = {${items}};`);
    }
    return lines.join("\n");
  }

  entryPoint() {
    const greenFlags = this.events.filter((event) => event.opcode === "event_whenflagclicked");
    const keyEvents = this.events.filter((event) => event.opcode === "event_whenkeypressed");
    if (greenFlags.length === 0 && keyEvents.length === 0) return "";
    const lines = ["", "", "int main() {", this.indent(1) + "std::srand(static_cast<unsigned int>(std::time(nullptr)));"];
    for (const event of greenFlags) lines.push(this.indent(1) + `${event.name}();`);
    if (keyEvents.length > 0) {
      lines.push(this.indent(1) + "while (true) {");
      lines.push(this.indent(2) + "std::cout << \"Press a Scratch key (or Enter to quit): \";");
      lines.push(this.indent(2) + "std::string key;");
      lines.push(this.indent(2) + "std::getline(std::cin, key);");
      lines.push(this.indent(2) + "if (key.empty()) break;");
      keyEvents.forEach((event, index) => {
        lines.push(this.indent(2) + `${index === 0 ? "if" : "else if"} (key == ${JSON.stringify(event.key)}) ${event.name}();`);
      });
      lines.push(this.indent(1) + "}");
    }
    lines.push(this.indent(1) + "return 0;");
    lines.push("}");
    return lines.join("\n");
  }

  globalNames() {
    const names = Object.values(this.target.variables || {}).map((variable) => this.identifier(variable[0]));
    if (Object.values(this.blocks).some((block) => block?.opcode === "sensing_askandwait" || block?.opcode === "sensing_answer")) names.push(this.identifier("answer"));
    return [...new Set(names)];
  }

  listIndex(name, index) {
    if (index === this.literal("last")) return `(${name}.size() - 1)`;
    if (index === this.literal("random")) return `(std::rand() % ${name}.size())`;
    return `(to_int(${index}) - 1)`;
  }

  convertScript(blockId) {
    return `${super.convertScript(blockId)}\n}`;
  }

  blockWithBody(level, header, substackId) {
    const body = this.convertSequence(substackId, level + 1) || this.indent(level + 1) + this.noop();
    return [this.indent(level) + header, body, this.indent(level) + "}"];
  }

  ifElseBlock(level, block) {
    const ifBody = this.convertSequence(block.inputs?.SUBSTACK?.[1], level + 1) || this.indent(level + 1) + this.noop();
    const elseBody = this.convertSequence(block.inputs?.SUBSTACK2?.[1], level + 1) || this.indent(level + 1) + this.noop();
    return [
      this.indent(level) + this.ifHeader(this.value(block, "CONDITION")),
      ifBody,
      this.indent(level) + this.elseHeader(),
      elseBody,
      this.indent(level) + "}"
    ];
  }
}

class JavaScriptConverter extends CppConverter {
  wrap(code) {
    return `// Converted from Scratch 3 target: ${this.target.name}\nconst readline = require("readline");\nconst rl = readline.createInterface({ input: process.stdin, output: process.stdout });\nconst ask = (question) => new Promise((resolve) => rl.question(String(question) + " ", resolve));\nconst currentDatePart = (part) => {\n  const now = new Date();\n  const pad = (value) => String(value).padStart(2, "0");\n  return part === "year" ? String(now.getFullYear()) : part === "month" ? pad(now.getMonth() + 1) : part === "date" ? pad(now.getDate()) : part === "dayofweek" ? String(now.getDay() + 1) : part === "hour" ? pad(now.getHours()) : part === "minute" ? pad(now.getMinutes()) : pad(now.getSeconds());\n};\n\n${this.declarations()}\n\n${code || "// No scripts found."}${this.entryPoint()}`;
  }

  eventHeader(name) { return `async function ${this.camelName(name)}() {`; }
  repeatHeader(times) { return `for (let i = 0; i < Number(${times}); i++) {`; }
  literal(value) { return isNumeric(value) ? String(value) : JSON.stringify(String(value)); }
  call(name, args) { return `${this.camelName(name)}(${args.join(", ")});`; }
  assign(name, value) { return `${this.camelName(name)} = ${value};`; }
  increment(name, value) { return `${this.camelName(name)} += ${value};`; }
  toString(value) { return `String(${value})`; }
  randomExpr(from, to) { return `(Math.floor(Math.random() * (${to} - ${from} + 1)) + ${from})`; }
  roundExpr(value) { return `Math.round(${value})`; }
  containsExpr(haystack, needle) { return `${haystack}.includes(${needle})`; }
  printStatement(value) { return `console.log(${value});`; }
  inputExpression(prompt) { return `await ask(${prompt})`; }
  listAppend(name, value) { return `${name}.push(${value});`; }
  listDelete(name, index) { return `${name}.splice(${this.listIndex(name, index)}, 1);`; }
  listClear(name) { return `${name}.length = 0;`; }
  listInsert(name, index, value) { return `${name}.splice(${this.listIndex(name, index)}, 0, ${value});`; }
  listReplace(name, index, value) { return `${name}[${this.listIndex(name, index)}] = ${value};`; }
  listItem(name, index) { return `${name}[${this.listIndex(name, index)}]`; }
  listLength(name) { return `${name}.length`; }
  listContains(name, value) { return `${name}.includes(${value})`; }
  currentDatePart(part) { return `currentDatePart(${JSON.stringify(String(part).toLowerCase())})`; }

  declarations() {
    const lines = this.globalNames().map((name) => `let ${this.camelName(name)} = "";`);
    for (const [, list] of Object.entries(this.target.lists || {})) {
      lines.push(`let ${this.identifier(list[0])} = ${JSON.stringify(list[1] || [])};`);
    }
    return lines.join("\n");
  }

  entryPoint() {
    const greenFlags = this.events.filter((event) => event.opcode === "event_whenflagclicked");
    const keyEvents = this.events.filter((event) => event.opcode === "event_whenkeypressed");
    if (greenFlags.length === 0 && keyEvents.length === 0) return "";
    const lines = ["", "", "async function main() {"];
    for (const event of greenFlags) lines.push(this.indent(1) + `await ${this.camelName(event.name)}();`);
    if (keyEvents.length > 0) {
      lines.push(this.indent(1) + "while (true) {");
      lines.push(this.indent(2) + "const key = await ask(\"Press a Scratch key (or Enter to quit):\");");
      lines.push(this.indent(2) + "if (key === \"\") break;");
      keyEvents.forEach((event, index) => {
        lines.push(this.indent(2) + `${index === 0 ? "if" : "else if"} (key.toLowerCase() === ${JSON.stringify(event.key.toLowerCase())}) await ${this.camelName(event.name)}();`);
      });
      lines.push(this.indent(1) + "}");
    }
    lines.push(this.indent(1) + "rl.close();");
    lines.push("}");
    lines.push("main();");
    return lines.join("\n");
  }

  listIndex(name, index) {
    if (index === this.literal("last")) return `(${name}.length - 1)`;
    if (index === this.literal("random")) return `Math.floor(Math.random() * ${name}.length)`;
    return `(Number(${index}) - 1)`;
  }

  identifier(name) {
    return this.camelName(super.identifier(name));
  }

  camelName(name) {
    return String(name).replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
  }
}

class JavaConverter extends CppConverter {
  wrap(code) {
    const className = this.className(this.target.name || "ScratchTarget");
    return `// Converted from Scratch 3 target: ${this.target.name}\nimport java.time.LocalDateTime;\nimport java.util.ArrayList;\nimport java.util.Arrays;\nimport java.util.Scanner;\n\npublic class ${className} {\nstatic Scanner scanner = new Scanner(System.in);\n\nstatic String ask(String question) {\n  System.out.print(question + " ");\n  return scanner.nextLine();\n}\n\nstatic String currentDatePart(String part) {\n  LocalDateTime now = LocalDateTime.now();\n  return switch (part) {\n    case "year" -> String.valueOf(now.getYear());\n    case "month" -> String.format("%02d", now.getMonthValue());\n    case "date" -> String.format("%02d", now.getDayOfMonth());\n    case "dayofweek" -> now.getDayOfWeek().toString();\n    case "hour" -> String.format("%02d", now.getHour());\n    case "minute" -> String.format("%02d", now.getMinute());\n    default -> String.format("%02d", now.getSecond());\n  };\n}\n\n${this.declarations()}\n\n${code || this.indent(1) + "// No scripts found."}${this.entryPoint()}\n}`;
  }

  eventHeader(name) { return `public static void ${this.camelName(name)}() {`; }
  repeatHeader(times) { return `for (int i = 0; i < (int)(${times}); i++) {`; }
  literal(value) { return isNumeric(value) ? String(value) : JSON.stringify(String(value)); }
  call(name, args) { return `${this.camelName(name)}(${args.join(", ")});`; }
  assign(name, value) { return `${this.camelName(name)} = ${value};`; }
  increment(name, value) { return `${this.camelName(name)} += ${value};`; }
  toString(value) { return `String.valueOf(${value})`; }
  randomExpr(from, to) { return `((int)(Math.random() * (${to} - ${from} + 1)) + ${from})`; }
  roundExpr(value) { return `Math.round(${value})`; }
  containsExpr(haystack, needle) { return `${haystack}.contains(${needle})`; }
  printStatement(value) { return `System.out.println(${value});`; }
  inputExpression(prompt) { return `ask(String.valueOf(${prompt}))`; }
  listAppend(name, value) { return `${name}.add(String.valueOf(${value}));`; }
  listDelete(name, index) { return `${name}.remove(${this.listIndex(name, index)});`; }
  listClear(name) { return `${name}.clear();`; }
  listInsert(name, index, value) { return `${name}.add(${this.listIndex(name, index)}, String.valueOf(${value}));`; }
  listReplace(name, index, value) { return `${name}.set(${this.listIndex(name, index)}, String.valueOf(${value}));`; }
  listItem(name, index) { return `${name}.get(${this.listIndex(name, index)})`; }
  listLength(name) { return `${name}.size()`; }
  listContains(name, value) { return `${name}.contains(String.valueOf(${value}))`; }
  currentDatePart(part) { return `currentDatePart(${JSON.stringify(String(part).toLowerCase())})`; }

  declarations() {
    const lines = this.globalNames().map((name) => `static String ${this.camelName(name)} = "";`);
    for (const [, list] of Object.entries(this.target.lists || {})) {
      const items = (list[1] || []).map((item) => JSON.stringify(String(item))).join(", ");
      lines.push(`static ArrayList<String> ${this.identifier(list[0])} = new ArrayList<>(Arrays.asList(${items}));`);
    }
    return lines.join("\n");
  }

  entryPoint() {
    const greenFlags = this.events.filter((event) => event.opcode === "event_whenflagclicked");
    const keyEvents = this.events.filter((event) => event.opcode === "event_whenkeypressed");
    if (greenFlags.length === 0 && keyEvents.length === 0) return "";
    const lines = ["", "", "public static void main(String[] args) {"];
    for (const event of greenFlags) lines.push(this.indent(1) + `${this.camelName(event.name)}();`);
    if (keyEvents.length > 0) {
      lines.push(this.indent(1) + "while (true) {");
      lines.push(this.indent(2) + "System.out.print(\"Press a Scratch key (or Enter to quit): \");");
      lines.push(this.indent(2) + "String key = scanner.nextLine();");
      lines.push(this.indent(2) + "if (key.isEmpty()) break;");
      keyEvents.forEach((event, index) => {
        lines.push(this.indent(2) + `${index === 0 ? "if" : "else if"} (key.equalsIgnoreCase(${JSON.stringify(event.key)})) ${this.camelName(event.name)}();`);
      });
      lines.push(this.indent(1) + "}");
    }
    lines.push("}");
    return lines.join("\n");
  }

  listIndex(name, index) {
    if (index === this.literal("last")) return `(${name}.size() - 1)`;
    if (index === this.literal("random")) return `((int)(Math.random() * ${name}.size()))`;
    return `(Integer.parseInt(String.valueOf(${index})) - 1)`;
  }

  identifier(name) {
    return this.camelName(super.identifier(name));
  }

  camelName(name) {
    return String(name).replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
  }

  className(name) {
    const cleaned = String(name).replace(/[^a-zA-Z0-9]+/g, " ").trim().split(/\s+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
    return /^[A-Za-z]/.test(cleaned) ? cleaned : "ScratchTarget";
  }
}

class CSharpConverter extends JavaConverter {
  wrap(code) {
    const className = this.className(this.target.name || "ScratchTarget");
    return `// Converted from Scratch 3 target: ${this.target.name}\nusing System;\nusing System.Collections.Generic;\n\npublic class ${className}\n{\nstatic string Ask(string question)\n{\n  Console.Write(question + " ");\n  return Console.ReadLine() ?? "";\n}\n\nstatic string CurrentDatePart(string part)\n{\n  var now = DateTime.Now;\n  return part switch\n  {\n    "year" => now.ToString("yyyy"),\n    "month" => now.ToString("MM"),\n    "date" => now.ToString("dd"),\n    "dayofweek" => now.DayOfWeek.ToString(),\n    "hour" => now.ToString("HH"),\n    "minute" => now.ToString("mm"),\n    _ => now.ToString("ss")\n  };\n}\n\n${this.declarations()}\n\n${code || this.indent(1) + "// No scripts found."}${this.entryPoint()}\n}`;
  }

  eventHeader(name) { return `public static void ${this.pascalName(name)}() {`; }
  repeatHeader(times) { return `for (int i = 0; i < (int)(${times}); i++) {`; }
  call(name, args) { return `${this.pascalName(name)}(${args.join(", ")});`; }
  increment(name, value) { return `${this.camelName(name)} += ${value};`; }
  assign(name, value) { return `${this.camelName(name)} = ${value};`; }
  toString(value) { return `Convert.ToString(${value})`; }
  randomExpr(from, to) { return `Random.Shared.Next((int)(${from}), (int)(${to}) + 1)`; }
  roundExpr(value) { return `Math.Round(${value})`; }
  containsExpr(haystack, needle) { return `${haystack}.Contains(${needle})`; }
  printStatement(value) { return `Console.WriteLine(${value});`; }
  inputExpression(prompt) { return `Ask(Convert.ToString(${prompt}) ?? "")`; }
  listAppend(name, value) { return `${this.camelName(name)}.Add(Convert.ToString(${value}) ?? "");`; }
  listDelete(name, index) { return `${this.camelName(name)}.RemoveAt(${this.listIndex(name, index)});`; }
  listClear(name) { return `${this.camelName(name)}.Clear();`; }
  listInsert(name, index, value) { return `${this.camelName(name)}.Insert(${this.listIndex(name, index)}, Convert.ToString(${value}) ?? "");`; }
  listReplace(name, index, value) { return `${this.camelName(name)}[${this.listIndex(name, index)}] = Convert.ToString(${value}) ?? "";`; }
  listItem(name, index) { return `${this.camelName(name)}[${this.listIndex(name, index)}]`; }
  listLength(name) { return `${this.camelName(name)}.Count`; }
  listContains(name, value) { return `${this.camelName(name)}.Contains(Convert.ToString(${value}) ?? "")`; }
  currentDatePart(part) { return `CurrentDatePart(${JSON.stringify(String(part).toLowerCase())})`; }

  declarations() {
    const lines = this.globalNames().map((name) => `static string ${this.camelName(name)} = "";`);
    for (const [, list] of Object.entries(this.target.lists || {})) {
      const items = (list[1] || []).map((item) => JSON.stringify(String(item))).join(", ");
      lines.push(`static List<string> ${this.identifier(list[0])} = new List<string> { ${items} };`);
    }
    return lines.join("\n");
  }

  entryPoint() {
    const greenFlags = this.events.filter((event) => event.opcode === "event_whenflagclicked");
    const keyEvents = this.events.filter((event) => event.opcode === "event_whenkeypressed");
    if (greenFlags.length === 0 && keyEvents.length === 0) return "";
    const lines = ["", "", "public static void Main(string[] args)", "{"];
    for (const event of greenFlags) lines.push(this.indent(1) + `${this.pascalName(event.name)}();`);
    if (keyEvents.length > 0) {
      lines.push(this.indent(1) + "while (true)");
      lines.push(this.indent(1) + "{");
      lines.push(this.indent(2) + "Console.Write(\"Press a Scratch key (or Enter to quit): \");");
      lines.push(this.indent(2) + "var key = Console.ReadLine() ?? \"\";");
      lines.push(this.indent(2) + "if (key == \"\") break;");
      keyEvents.forEach((event, index) => {
        lines.push(this.indent(2) + `${index === 0 ? "if" : "else if"} (key.Equals(${JSON.stringify(event.key)}, StringComparison.OrdinalIgnoreCase)) ${this.pascalName(event.name)}();`);
      });
      lines.push(this.indent(1) + "}");
    }
    lines.push("}");
    return lines.join("\n");
  }

  listIndex(name, index) {
    if (index === this.literal("last")) return `(${this.camelName(name)}.Count - 1)`;
    if (index === this.literal("random")) return `Random.Shared.Next(${this.camelName(name)}.Count)`;
    return `(int.Parse(Convert.ToString(${index}) ?? "1") - 1)`;
  }

  identifier(name) {
    return this.camelName(BaseConverter.prototype.identifier.call(this, name));
  }

  pascalName(name) {
    const camel = this.camelName(BaseConverter.prototype.identifier.call(this, name));
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }
}

function downloadCode() {
  const language = languageSelect.value;
  const extension = (languages[language] || languages.python).extension;
  const blob = new Blob([codeOutput.textContent], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `scratch-converted.${extension}`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function showMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

function clearMessage() {
  message.textContent = "";
  message.hidden = true;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}

function isNumeric(value) {
  return value !== null && value !== undefined && String(value).trim() !== "" && !Number.isNaN(Number(value));
}
