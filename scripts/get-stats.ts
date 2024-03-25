/**
 * Статистика по тикеру.
 * npx ts-node-esm scripts/get-stats.ts
 */
import { RealAccount, SandboxAccount, TinkoffAccount } from 'tinkoff-invest-api';
import {
  Operation,
  OperationState,
  OperationType,
  PortfolioPosition,
  PortfolioResponse
} from 'tinkoff-invest-api/cjs/generated/operations.js';
import { Account } from "tinkoff-invest-api/cjs/generated/users.js";
import { api } from './init-api.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import prompts from 'prompts';
import kleur from 'kleur';
import { Instrument, InstrumentIdType } from "tinkoff-invest-api/cjs/generated/instruments.js";
import { groupBy } from "../src/utils/groupBy.js";

interface Arguments extends yargs.Arguments {
  short: boolean;
  start: string;
  end: string;
}

interface OperationsByFigi {
  [ figi: string ]: Operation[];
}

const args: Arguments = yargs(hideBin(process.argv))
  .option('short', {
    global: true,
    type: 'boolean',
    description: 'Показать только общие данные, без операций (по умолчанию False)',
    default: false,
  })
  .option('start', {
    global: true,
    alias: 's',
    type: 'string',
    description: 'Дата начала периода. Формат: YYYY-mm-dd',
    default: 0,
  })
  .option('end', {
    global: true,
    alias: 'e',
    type: 'string',
    description: 'Дата завершения периода. Формат: YYYY-mm-dd',
    default: 0,
  })
  .help()
  .parse() as Arguments;

await main(args);

async function main(args: Arguments) {
  const { start, end } = await getPeriod(args);

  const accounts = (await api.users.getAccounts({})).accounts;

  if (accounts.length < 1) {
    console.log(kleur.red('Нет аккаунтов'));
    return;
  }

  let select_another_account = 1;
  while (select_another_account > 0) {
    select_another_account = await selectAccountCycle(accounts, start, end);
  }

}

async function getPeriod(args: Arguments) {
  let start: Date = new Date(args.start);
  let end: Date = new Date(args.end);

  if (args.end == "0") {
    end = new Date();
  }
  end.setHours(23, 59, 59, 999);

  if (args.start == "0") {
    start = new Date(end.getTime() - 8 * 365 * 24 * 60 * 60 * 1000);
  }

  start.setHours(0, 0, 0, 0);

  console.log(`Период: ${start.toString()} - ${end.toString()}`);

  return { start, end };
}

async function selectAccountCycle(accounts: Account[], start: Date, end: Date): Promise<number> {
  const { api_account, portfolio, operations }
    = await selectAccount(accounts, start, end);
  if (!api_account) {
    return 0;
  }

  let select_another_position = 1;
  while (select_another_position > 0) {
    select_another_position = await selectPositionCycle({
      api_account: api_account,
      portfolio: portfolio,
      allOperations: operations,
      start: start,
      end: end
    });
  }

  const response = await prompts({
    type: 'number',
    name: 'select_another',
    message: `Выбрать другой аккаунт? (1 - да, 0 - нет) :`,
  });
  return response.select_another;
}

async function selectPositionCycle(options: {
  api_account: RealAccount | SandboxAccount, portfolio: PortfolioResponse,
  allOperations: OperationsByFigi,
  start: Date, end: Date
}): Promise<number> {
  const selectedFigi = await selectPosition(options.portfolio.positions, options.allOperations);

  const operationsResponse = await api.operations.getOperations({
    accountId: options.api_account.accountId,
    state: OperationState.OPERATION_STATE_EXECUTED,
    from: options.start,
    to: options.end,
    figi: selectedFigi,
  });

  await countPerformance({
    account: options.api_account,
    figi: selectedFigi,
    position: options.portfolio.positions[ selectedFigi ],
    // operations: options.allOperations[ selectedFigi ],
    operations: operationsResponse.operations,
    start: options.start,
    end: options.end,
    short: args.short
  });

  const response = await prompts({
    type: 'number',
    name: 'select_another',
    message: `Выбрать другую позицию? (1 - да, 0 - нет) :`,
  });

  return response.select_another;
}

async function selectAccount(accounts: Account[], start: Date, end: Date):
  Promise<{ api_account: RealAccount, portfolio: PortfolioResponse, operations: OperationsByFigi }> {

  const {
    portfolios,
    allOperations,
    api_accounts
  } = await prepareAndShowAccounts(accounts, start, end);

  const response = await prompts({
    type: 'number',
    name: 'account_number',
    message: `Какой аккаунт использовать (${[...accounts.keys()]})? :`,
    validate: value => value >= 0 && value < accounts.length,
    initial: 0,
    min: 0,
    max: accounts.length - 1,
  });
  const api_account = api_accounts[ response.account_number ],
    portfolio = portfolios[ response.account_number ],
    operations = allOperations[ response.account_number ];
  // account = accounts[ response.account_number ];

  return { api_account, portfolio, operations };
}

async function prepareAndShowAccounts(accounts: Account[], start: Date, end: Date) {
  const portfolios: PortfolioResponse[] = [],
    allOperations: OperationsByFigi[] = [],
    api_accounts: RealAccount[] = [];

  for (const key in accounts) {
    api_accounts[ key ] = new RealAccount(api, accounts[ key ].id);
    portfolios[ key ] = await api_accounts[ key ].getPortfolio();

    portfolios[ key ].positions = groupBy(portfolios[ key ].positions, 'figi');

    const operationsResponse = await api.operations.getOperations({
      accountId: accounts[ key ].id,
      state: OperationState.OPERATION_STATE_EXECUTED,
      from: start,
      to: end,
      figi: '',
    });

    allOperations[ key ] = groupBy(operationsResponse.operations.filter((operation) => {
        return operation.figi != '';
      }),
      'figi');

    showAccountHeader(api_accounts[ key ], portfolios[ key ], accounts[ key ], key);
  }
  return { portfolios, allOperations, api_accounts };
}

function showAccountHeader(account: TinkoffAccount, portfolio: PortfolioResponse, a: Account, key: string) {
  const expectedYield = portfolio.expectedYield ? api.helpers.toNumber(portfolio.expectedYield) : 0;

  const s = [
    `#${key}:`,
    kleur.bold().underline(a.name),
    `(${account.accountId})`,
    expectedYield > 0
      ? kleur.green(`(${expectedYield}%)`)
      : kleur.red(`(${expectedYield}%)`),
    "\n",
    `Валюта: ${kleur.underline(api.helpers.toMoneyString(portfolio.totalAmountCurrencies))},`,
    `Акции: ${kleur.underline(api.helpers.toMoneyString(portfolio.totalAmountShares))},`,
    `Облигации: ${kleur.underline(api.helpers.toMoneyString(portfolio.totalAmountBonds))},`,
    `ETF: ${kleur.underline(api.helpers.toMoneyString(portfolio.totalAmountEtf))},`,
    `Фьючерсы: ${kleur.underline(api.helpers.toMoneyString(portfolio.totalAmountFutures))}`,
  ].join(' ');
  console.log(s + "\n");

}

async function selectPosition(positions: PortfolioPosition[], operations: OperationsByFigi) {
  let figis = [...Object.keys(operations), ...Object.keys(positions)];
  figis = [...new Set(figis)]
  let key = 0;
  for (const figi of figis) {
    let position = positions[ figi ] || undefined;
    if (position) {
      position = position[ 0 ];
    }

    const position_string = await showPosition(figi, key++, position);
    if (!position) {
      console.log(kleur.blue(position_string));
    } else {
      const expectedYield = position && position.expectedYield ? api.helpers.toNumber(position.expectedYield) : 0;
      console.log(expectedYield >= 0 ? kleur.green(position_string) : kleur.red(position_string));
    }
  }

  console.log("\n");
  const response = await prompts({
    type: 'number',
    name: 'position_number',
    message: `По какой позиции вывести отчет (0 - ${figis.length - 1})? :`,
    validate: value => value >= 0 && value < figis.length,
    initial: 0,
    min: 0,
    max: figis.length - 1,
  });

  return figis[ response.position_number ];
}

async function showPosition(figi: string, key: number, p: PortfolioPosition) {

  const currency = p?.averagePositionPrice?.currency || '';

  const instrument_info = await getInfo(figi);

  const s = [
    `# ${key}:`,
    instrument_info?.name,
    `t: ${instrument_info?.ticker}`,
    `f: ${figi}`,
  ];

  if (p) {
    s.push(`(${p?.instrumentType}, ${api.helpers.toNumber(p?.quantity)} шт.)`);
    s.push(`(${api.helpers.toNumber(p?.expectedYield)} ${currency})`);
  }

  return s.join(', ');
}

async function getInfo(figi: string): Promise<Instrument | undefined> {
  const { instrument } = await api.instruments.getInstrumentBy({
    idType: InstrumentIdType.INSTRUMENT_ID_TYPE_FIGI,
    classCode: '',
    id: figi
  });
  return instrument;
}

// eslint-disable-next-line
async function countPerformance(options: {
  account: RealAccount | SandboxAccount,
  figi: string,
  position: PortfolioPosition,
  operations: Operation[],
  start: Date, end: Date, short: boolean
}) {

  options.position = options.position ? options.position[ 0 ] : undefined;

  if (!options.operations) {
    console.log(kleur.red("Нет операций за выбранный период."));
    return;
  }

  const
    {
      message,
      total_buys,
      total_sells,
      total_operations,
      turnover,
      dividend,
      taxes,
      taxes_back,
      commissions,
      service_commission,
      total_buys_price,
      balance,
      bond_repayment,
    } = processOperations(options.operations);

  const possible_revenue =
    (api.helpers.toNumber(options.position?.quantity) || 0)
    * (api.helpers.toNumber(options.position?.currentPrice) || 0)
    + balance;

  if (!options.short) {
    console.log(message);
  }

  console.log(kleur.bold(kleur.bgYellow(kleur.black("Figi: "))) + options.figi);
  console.log(kleur.yellow("Всего куплено: ") + total_buys);
  console.log(kleur.yellow("Всего продано: ") + total_sells);
  console.log(kleur.yellow("Текущий баланс: ") + (api.helpers.toNumber(options.position?.quantity) || 0));
  console.log(kleur.yellow("Дивиденды и купоны: ") + dividend);
  if (bond_repayment > 0) {
    console.log(kleur.yellow("Погашение облигаций: ") + bond_repayment);
  }
  console.log(kleur.yellow("Всего операций: ") + total_operations);
  console.log(kleur.yellow("Всего комиссий: ") + commissions);
  console.log(kleur.yellow("Оплата тарифа: ") + service_commission);
  console.log(kleur.yellow("Всего налогов: ") + taxes);
  console.log(kleur.yellow("Корректировка налогов: ") + taxes_back);
  console.log(kleur.blue("Оборот: " + turnover));
  console.log(kleur.blue("Ср.Цена за штуку: " + total_buys_price / total_buys));

  console.log(balance > 0 ? kleur.green("Доход: " + balance) : kleur.red("Убыток: " + balance));

  console.log(kleur.blue("Если продать текущие позиции:"));

  console.log(possible_revenue > 0 ? kleur.green("Доход: " + possible_revenue) : kleur.red("Убыток: " + possible_revenue));

}

// eslint-disable-next-line complexity
function processOperations(operations: Operation[]) {
  let
    message = "",
    total_buys = 0,
    total_sells = 0,
    total_operations = 0,
    turnover = 0,
    dividend = 0,
    taxes = 0,
    taxes_back = 0,
    commissions = 0,
    service_commission = 0,
    total_buys_price = 0,
    total_sell_price = 0,
    balance = 0,
    bond_repayment = 0;

  //console.log(operations)

  for (const operation of operations) {
    const o_price = api.helpers.toNumber(operation.price) || 0;
    const payment = api.helpers.toNumber(operation.payment) || 0;
    const operation_price = operation.quantity * o_price;
    switch (operation.operationType) {
      case OperationType.OPERATION_TYPE_BUY:
      case OperationType.OPERATION_TYPE_BUY_CARD:
        total_buys += operation.quantity;
        total_buys_price += operation_price;
        message += `${kleur.bold().red("- ")} ${o_price} * ${operation.quantity} = ${operation_price} ${operation.currency} \n`;
        balance -= (operation.quantity * o_price);
        turnover += (operation.quantity * o_price);
        total_operations += 1;
        break;

      case OperationType.OPERATION_TYPE_SELL:
      case OperationType.OPERATION_TYPE_SELL_CARD:
        total_sells += operation.quantity;
        total_sell_price += operation_price;
        message += `${kleur.bold().green("+ ")} ${o_price} * ${operation.quantity} = ${operation_price} ${operation.currency} \n`;
        balance += (operation.quantity * o_price);
        turnover += (operation.quantity * o_price);
        total_operations += 1;
        break;

      case OperationType.OPERATION_TYPE_DIVIDEND:
      case OperationType.OPERATION_TYPE_COUPON:
        message += `${kleur.green("+ div:  ")} ${api.helpers.toMoneyString(operation.payment)} \n`;
        balance += payment;
        dividend += payment;
        break;
      case OperationType.OPERATION_TYPE_DIVIDEND_TAX:
      case OperationType.OPERATION_TYPE_BENEFIT_TAX:
      case OperationType.OPERATION_TYPE_BOND_TAX:
      case OperationType.OPERATION_TYPE_TAX:
        message += `${kleur.red("- tax:  ")} ${api.helpers.toMoneyString(operation.payment)} \n`;

        balance += payment;
        taxes += payment;
        break;

      case OperationType.OPERATION_TYPE_TAX_CORRECTION:
      case OperationType.OPERATION_TYPE_TAX_CORRECTION_COUPON:
        message += `${kleur.green("+ tax_back:  ")} + ${api.helpers.toMoneyString(operation.payment)}\n`;

        balance += payment;
        taxes_back += payment;
        break;
      case OperationType.OPERATION_TYPE_SUCCESS_FEE:
      case OperationType.OPERATION_TYPE_BROKER_FEE:
      case OperationType.OPERATION_TYPE_MARGIN_FEE:
        message += `${kleur.red("- fee:  ")} ${api.helpers.toMoneyString(operation.payment)} \n`;

        balance += payment;
        commissions += payment;
        break;
      case OperationType.OPERATION_TYPE_SERVICE_FEE:
        message += `${kleur.red("- service fee:  ")} ${api.helpers.toMoneyString(operation.payment)} \n`;

        balance += payment;
        service_commission += payment;
        break;
      case OperationType.OPERATION_TYPE_BOND_REPAYMENT:
        message += `${kleur.green("+ bond repayment:  ")} ${api.helpers.toMoneyString(operation.payment)} \n`;
        balance += payment;
        bond_repayment += payment;
        break;

      default:
        message += `${kleur.yellow("UNKNOWN")}\n`;
        console.log(operation);
        break;
    }

    if (operation.quantityRest > 0) {
      message += "\n";
      message += `${kleur.red('Rest: ')}${operation.quantityRest}\n`;
    }
  }
  return {
    message,
    total_buys,
    total_sells,
    total_operations,
    turnover,
    dividend,
    taxes,
    taxes_back,
    commissions,
    service_commission,
    total_buys_price,
    balance,
    bond_repayment
  };
}
