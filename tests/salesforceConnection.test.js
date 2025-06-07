import { SalesforceConnection } from '../src/background/salesforceConnection.js';

describe('SalesforceConnection', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('query paginates results', async () => {
    const responses = [
      {
        ok: true,
        json: async () => ({ records: [{ id: 1 }], nextRecordsUrl: '/next' }),
      },
      {
        ok: true,
        json: async () => ({ records: [{ id: 2 }], nextRecordsUrl: null }),
      },
    ];
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation(() => responses.shift());
    const conn = new SalesforceConnection({
      instanceUrl: 'https://example.com',
      accessToken: 'tok',
      version: '60.0',
    });
    const records = await conn.query('SELECT Id FROM Account');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(records).toEqual([{ id: 1 }, { id: 2 }]);
  });

  test('query throws on non-ok response', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, text: async () => 'err' });
    const conn = new SalesforceConnection({
      instanceUrl: 'https://example.com',
      accessToken: 'tok',
    });
    await expect(conn.query('SELECT')).rejects.toThrow('Salesforce GET');
  });
});
