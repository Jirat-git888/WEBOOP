class ExpressionParser {
  constructor(source) {
    this.source = source;
    this.tokens = this.tokenize(source);
    this.position = 0;
    this.functions = new Set(['sin', 'cos', 'tan', 'sqrt', 'ln', 'log', 'exp']);
  }

  tokenize(source) {
    const tokens = [];
    const pattern = /\s*([0-9]*\.?[0-9]+(?:[eE][+-]?[0-9]+)?|[A-Za-z_][A-Za-z_0-9]*|[()+\-*/^])/gy;
    let index = 0;

    while (index < source.length) {
      if (/^\s*$/.test(source.slice(index))) break;
      pattern.lastIndex = index;
      const match = pattern.exec(source);
      if (!match) throw new Error(`พบอักขระที่ไม่รองรับตรงตำแหน่ง ${index + 1}`);
      const value = match[1];
      const type = /^[0-9]/.test(value) || value.startsWith('.') ? 'number' : /^[A-Za-z_]/.test(value) ? 'identifier' : 'symbol';
      tokens.push({ type, value });
      index = pattern.lastIndex;
    }

    return tokens;
  }

  peek() {
    return this.tokens[this.position] ?? { type: 'eof', value: '' };
  }

  match(value) {
    if (this.peek().value !== value) return false;
    this.position += 1;
    return true;
  }

  expect(value) {
    if (!this.match(value)) throw new Error(`ต้องมีเครื่องหมาย ${value}`);
  }

  parse() {
    if (this.tokens.length === 0) throw new Error('กรุณาพิมพ์สมการ');
    const expression = this.parseExpression();
    if (this.peek().type !== 'eof') throw new Error(`ไม่เข้าใจส่วน "${this.peek().value}"`);
    return expression;
  }

  parseExpression() {
    let node = this.parseTerm();
    while (this.peek().value === '+' || this.peek().value === '-') {
      const operator = this.peek().value;
      this.position += 1;
      node = { type: 'binary', operator, left: node, right: this.parseTerm() };
    }
    return node;
  }

  startsPrimary(token) {
    return token.type === 'number' || token.type === 'identifier' || token.value === '(';
  }

  parseTerm() {
    let node = this.parseUnary();
    while (true) {
      const operator = this.peek().value;
      if (operator === '*' || operator === '/') {
        this.position += 1;
        node = { type: 'binary', operator, left: node, right: this.parseUnary() };
      } else if (this.startsPrimary(this.peek())) {
        node = { type: 'binary', operator: '*', left: node, right: this.parseUnary() };
      } else {
        return node;
      }
    }
  }

  parseUnary() {
    if (this.match('+')) return this.parseUnary();
    if (this.match('-')) return { type: 'unary', operator: '-', operand: this.parseUnary() };
    return this.parsePower();
  }

  parsePower() {
    const left = this.parsePrimary();
    if (this.match('^')) return { type: 'binary', operator: '^', left, right: this.parseUnary() };
    return left;
  }

  parsePrimary() {
    const token = this.peek();
    if (token.type === 'number') {
      this.position += 1;
      return { type: 'number', value: Number(token.value) };
    }
    if (this.match('(')) {
      const expression = this.parseExpression();
      this.expect(')');
      return expression;
    }
    if (token.type === 'identifier') {
      this.position += 1;
      const name = token.value.toLowerCase();
      if (this.functions.has(name)) {
        this.expect('(');
        const argument = this.parseExpression();
        this.expect(')');
        return { type: 'call', name, argument };
      }
      if (name === 'x') return { type: 'variable' };
      if (name === 'pi') return { type: 'number', value: Math.PI };
      if (name === 'e') return { type: 'number', value: Math.E };
      throw new Error(`ไม่รู้จักตัวแปรหรือฟังก์ชัน "${token.value}"`);
    }
    throw new Error(token.type === 'eof' ? 'สมการยังไม่ครบ' : `ไม่เข้าใจส่วน "${token.value}"`);
  }
}

function evaluateExpression(node, x) {
  if (node.type === 'number') return node.value;
  if (node.type === 'variable') return x;
  if (node.type === 'unary') return -evaluateExpression(node.operand, x);
  if (node.type === 'call') {
    const value = evaluateExpression(node.argument, x);
    const functions = {
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      sqrt: Math.sqrt,
      ln: Math.log,
      log: Math.log10,
      exp: Math.exp,
    };
    return functions[node.name](value);
  }

  const left = evaluateExpression(node.left, x);
  const right = evaluateExpression(node.right, x);
  if (node.operator === '+') return left + right;
  if (node.operator === '-') return left - right;
  if (node.operator === '*') return left * right;
  if (node.operator === '/') return left / right;
  return left ** right;
}

const numberNode = (value) => ({ type: 'number', value });
const unaryNode = (operand) => ({ type: 'unary', operator: '-', operand });
const binaryNode = (operator, left, right) => ({ type: 'binary', operator, left, right });
const callNode = (name, argument) => ({ type: 'call', name, argument });

function parseUserEquation(source) {
  const sides = source.split('=');
  if (sides.length > 2) throw new Error('สมการใส่เครื่องหมาย = ได้หนึ่งตำแหน่ง');
  if (sides.length === 1) return { expression: new ExpressionParser(source).parse(), display: source };

  const [left, right] = sides.map((side) => side.trim());
  if (!left || !right) throw new Error('สมการทั้งสองข้างต้องมีนิพจน์');
  return {
    expression: binaryNode('-', new ExpressionParser(left).parse(), new ExpressionParser(right).parse()),
    display: `${left} - (${right})`,
  };
}

function differentiate(node) {
  if (node.type === 'number') return numberNode(0);
  if (node.type === 'variable') return numberNode(1);
  if (node.type === 'unary') return unaryNode(differentiate(node.operand));
  if (node.type === 'call') {
    const value = node.argument;
    const slope = differentiate(value);
    if (node.name === 'sin') return binaryNode('*', callNode('cos', value), slope);
    if (node.name === 'cos') return binaryNode('*', unaryNode(callNode('sin', value)), slope);
    if (node.name === 'tan') return binaryNode('/', slope, binaryNode('^', callNode('cos', value), numberNode(2)));
    if (node.name === 'sqrt') return binaryNode('/', slope, binaryNode('*', numberNode(2), callNode('sqrt', value)));
    if (node.name === 'ln') return binaryNode('/', slope, value);
    if (node.name === 'log') return binaryNode('/', slope, binaryNode('*', value, numberNode(Math.LN10)));
    return binaryNode('*', callNode('exp', value), slope);
  }

  const left = node.left;
  const right = node.right;
  const dLeft = differentiate(left);
  const dRight = differentiate(right);
  if (node.operator === '+') return binaryNode('+', dLeft, dRight);
  if (node.operator === '-') return binaryNode('-', dLeft, dRight);
  if (node.operator === '*') {
    return binaryNode('+', binaryNode('*', dLeft, right), binaryNode('*', left, dRight));
  }
  if (node.operator === '/') {
    const numerator = binaryNode('-', binaryNode('*', dLeft, right), binaryNode('*', left, dRight));
    return binaryNode('/', numerator, binaryNode('^', right, numberNode(2)));
  }
  const constantExponent = getConstantValue(right);
  if (constantExponent !== null) {
    return binaryNode('*', binaryNode('*', numberNode(constantExponent), binaryNode('^', left, numberNode(constantExponent - 1))), dLeft);
  }

  const logarithmicSlope = binaryNode('+',
    binaryNode('*', dRight, callNode('ln', left)),
    binaryNode('*', right, binaryNode('/', dLeft, left)),
  );
  return binaryNode('*', binaryNode('^', left, right), logarithmicSlope);
}

function getConstantValue(node) {
  if (node.type === 'number') return node.value;
  if (node.type === 'variable' || node.type === 'call') return null;
  if (node.type === 'unary') {
    const value = getConstantValue(node.operand);
    return value === null ? null : -value;
  }
  const left = getConstantValue(node.left);
  const right = getConstantValue(node.right);
  if (left === null || right === null) return null;
  if (node.operator === '+') return left + right;
  if (node.operator === '-') return left - right;
  if (node.operator === '*') return left * right;
  if (node.operator === '/') return left / right;
  return left ** right;
}

class NewtonRaphsonDemo {
  constructor(expression, initialGuess, tolerance = 1e-6, maxIterations = 20) {
    this.expression = expression;
    this.derivative = differentiate(expression);
    this.initialGuess = initialGuess;
    this.tolerance = tolerance;
    this.maxIterations = maxIterations;
  }

  calculate() {
    const rows = [];
    let x = this.initialGuess;

    for (let iteration = 1; iteration <= this.maxIterations; iteration += 1) {
      const slope = evaluateExpression(this.derivative, x);
      if (!Number.isFinite(slope) || Math.abs(slope) < 1e-14) return { rows, status: 'zero-slope', value: x };

      const nextX = x - evaluateExpression(this.expression, x) / slope;
      if (!Number.isFinite(nextX)) return { rows, status: 'not-finite', value: x };

      const error = Math.abs(nextX - x);
      rows.push({ iteration, value: nextX, error });
      x = nextX;
      if (error < this.tolerance) return { rows, status: 'converged', value: x };
    }

    return { rows, status: 'max-iterations', value: x };
  }
}

const rowsContainer = document.querySelector('#iteration-rows');
const calculatorForm = document.querySelector('#calculator-form');
const equationInput = document.querySelector('#equation-input');
const equationLabel = document.querySelector('#equation-label');
const initialGuessInput = document.querySelector('#initial-guess');
const message = document.querySelector('#calculator-message');
const calculationState = document.querySelector('#calc-state');
const defaultEquation = 'x^2 - 2';
const formatNumber = (number) => number.toFixed(8);
const formatError = (number) => number.toFixed(5);

function showError(text) {
  rowsContainer.innerHTML = '';
  calculationState.classList.add('error');
  calculationState.innerHTML = 'CHECK INPUT <i></i>';
  message.classList.add('error');
  message.textContent = text;
}

function renderCalculation() {
  const equation = equationInput.value.trim() || defaultEquation;
  const initialGuess = Number(initialGuessInput.value);
  if (!Number.isFinite(initialGuess)) {
    showError('กรุณาใส่ค่าเริ่มต้น x₀ เป็นตัวเลข');
    return;
  }

  try {
    const parsedEquation = parseUserEquation(equation);
    const demo = new NewtonRaphsonDemo(parsedEquation.expression, initialGuess);
    const result = demo.calculate();
    equationLabel.textContent = `f(x) = ${parsedEquation.display}`;

    rowsContainer.innerHTML = result.rows.map((row, index) => `
      <div class="iteration-row ${index === result.rows.length - 1 ? 'final' : ''}">
        <span class="iter-count">${String(row.iteration).padStart(2, '0')}</span>
        <span class="iter-value">${formatNumber(row.value)}</span>
        <span class="iter-error">${formatError(row.error)}</span>
        <span class="iter-badge">${index === result.rows.length - 1 && result.status === 'converged' ? 'NEAR ROOT' : 'UPDATED'}</span>
      </div>
    `).join('');

    calculationState.classList.toggle('error', result.status !== 'converged');
    message.classList.toggle('error', result.status !== 'converged');
    if (result.status === 'converged') {
      calculationState.innerHTML = 'CONVERGED <i></i>';
      message.textContent = `เริ่มจาก x₀ = ${formatNumber(initialGuess)} ได้รากประมาณ ${formatNumber(result.value)}`;
    } else if (result.status === 'zero-slope') {
      calculationState.innerHTML = 'ZERO SLOPE <i></i>';
      message.textContent = 'อนุพันธ์เป็นศูนย์หรือคำนวณไม่ได้ที่ค่า x นี้ กรุณาลองเปลี่ยนค่า x₀';
    } else if (result.status === 'not-finite') {
      calculationState.innerHTML = 'INVALID RESULT <i></i>';
      message.textContent = 'คำนวณแล้วได้ค่าที่ไม่ถูกต้อง ลองเปลี่ยนสมการหรือค่า x₀';
    } else {
      calculationState.innerHTML = 'MAX ITERATIONS <i></i>';
      message.textContent = `คำนวณครบ ${result.rows.length} รอบแล้วยังไม่ลู่เข้า ลองเปลี่ยนสมการหรือค่า x₀`;
    }
  } catch (error) {
    showError(`สมการไม่ถูกต้อง: ${error.message}`);
  }
}

calculatorForm.addEventListener('submit', (event) => {
  event.preventDefault();
  renderCalculation();
});

renderCalculation();

const navLinks = [...document.querySelectorAll('.nav-link')];
const navSections = navLinks
  .map((link) => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);
const siteHeader = document.querySelector('.site-header');
let navUpdateQueued = false;

function updateActiveNav() {
  const readingLine = window.scrollY + siteHeader.offsetHeight + window.innerHeight * 0.25;
  let activeSection = navSections[0];

  for (const section of navSections) {
    if (section.offsetTop <= readingLine) activeSection = section;
  }

  navLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${activeSection.id}`;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  navUpdateQueued = false;
}

function queueNavUpdate() {
  if (navUpdateQueued) return;
  navUpdateQueued = true;
  window.requestAnimationFrame(updateActiveNav);
}

window.addEventListener('scroll', queueNavUpdate, { passive: true });
window.addEventListener('resize', queueNavUpdate);
window.addEventListener('hashchange', queueNavUpdate);
updateActiveNav();
