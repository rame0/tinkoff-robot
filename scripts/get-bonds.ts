/**
 * Статистика по тикеру.
 * npx ts-node-esm scripts/get-stats.ts
 */
import 'dotenv/config';
import { RealAccount, SandboxAccount, TinkoffAccount, TinkoffInvestApi } from 'tinkoff-invest-api';
import {
  Operation,
  OperationState, PortfolioPosition,
  PortfolioRequest_CurrencyRequest,
  PortfolioResponse
} from 'tinkoff-invest-api/cjs/generated/operations.js';
import { Account } from "tinkoff-invest-api/cjs/generated/users.js";
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import prompts from 'prompts';
import kleur from 'kleur';
import { InstrumentIdType, Bond } from "tinkoff-invest-api/cjs/generated/instruments.js";
import { groupBy } from "../src/utils/groupBy.js";

let api: TinkoffInvestApi;

interface Arguments extends yargs.Arguments {
  token: string;
}

interface OperationsByFigi {
  [ figi: string ]: Operation[];
}

interface PortfolioPositionWithInfo extends PortfolioPosition {
  info: Bond;
}

const args: Arguments = yargs(hideBin(process.argv))
  .option('token', {
    global: true,
    alias: 't',
    type: 'string',
    description: 'Ваш токен для доступа к Tinkoff Invest API',
    default: 0,
  })
  .help()
  .parse() as Arguments;

await main(args);

async function main(args: Arguments) {
  const token: string = args.token || process.env.TINKOFF_API_TOKEN;
  api = new TinkoffInvestApi({ token: token, appName: 'rame0/tinkoff-robot' });
  const accounts = (await api.users.getAccounts({})).accounts;

  if (accounts.length < 1) {
    console.log(kleur.red('Нет аккаунтов'));
    return;
  }
  await selectAccountCycle(accounts);
}

async function selectAccountCycle(accounts: Account[]): Promise<number> {
  const { api_account, portfolio, operations }
    = await selectAccount(accounts);
  if (!api_account) {
    return 0;
  }

  await selectPositionCycle({
    api_account: api_account,
    portfolio: portfolio,
    allOperations: operations,
  });
}

async function selectAccount(accounts: Account[]):
  Promise<{ api_account: RealAccount, portfolio: PortfolioResponse, operations: OperationsByFigi }> {

  const {
    portfolios,
    allOperations,
    api_accounts
  } = await prepareAndShowAccounts(accounts);

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

async function prepareAndShowAccounts(accounts: Account[]) {
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
  console.log([
    `#${key}:`,
    kleur.bold().underline(a.name),
    `(${account.accountId})`,
    expectedYield > 0
      ? kleur.green(`(${expectedYield}%)`)
      : kleur.red(`(${expectedYield}%)`),
    "\n",
    `Облигации: ${kleur.underline(api.helpers.toMoneyString(portfolio.totalAmountBonds))},`,
    "\n",
  ].join(' '));
}

async function selectPositionCycle(options: {
  api_account: RealAccount | SandboxAccount, portfolio: PortfolioResponse,
  allOperations: OperationsByFigi,
}) {

  const portfolio = await api.operations.getPortfolio({
    accountId: options.api_account.accountId,
    currency: PortfolioRequest_CurrencyRequest.RUB,
  });

  let bonds = portfolio.positions.filter((position) => {
    return position.instrumentType == "bond";
  });
  for (const key in bonds) {
    bonds[ key ][ "info" ] =  await getInfo(bonds[ key ].figi);
  }

  bonds = bonds.sort((a: PortfolioPositionWithInfo, b: PortfolioPositionWithInfo) => {
    return (new Date(a.info.maturityDate)).getTime() - (new Date(b.info.maturityDate)).getTime();
  });

  console.table(bonds.map((bond) => {
    return {
      name: bond[ "info" ]?.name,
      quantity: api.helpers.toNumber(bond.quantity),
      price: api.helpers.toMoneyString(bond.averagePositionPrice),
      sum: api.helpers.toNumber(bond.averagePositionPrice) * api.helpers.toNumber(bond.quantity),
      maturityDate: bond[ "info" ]?.maturityDate,
    };
  }));
}

async function getInfo(figi: string): Promise<Bond | undefined> {
  const { instrument } = await api.instruments.bondBy({
    idType: InstrumentIdType.INSTRUMENT_ID_TYPE_FIGI,
    classCode: '',
    id: figi
  });
  return instrument;
}
