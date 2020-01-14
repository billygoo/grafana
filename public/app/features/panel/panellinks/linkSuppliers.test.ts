import { getLinksFromLogsField, getFieldLinksSupplier } from './linkSuppliers';
import {
  ArrayVector,
  dateTime,
  Field,
  FieldType,
  toDataFrame,
  applyFieldOverrides,
  GrafanaTheme,
  FieldDisplay,
  DataFrameView,
} from '@grafana/data';
import { getLinkSrv, LinkService, LinkSrv, setLinkSrv } from './link_srv';
import { TemplateSrv } from '../../templating/template_srv';
import { TimeSrv } from '../../dashboard/services/TimeSrv';

describe('getLinksFromLogsField', () => {
  let originalLinkSrv: LinkService;
  beforeAll(() => {
    // We do not need more here and TimeSrv is hard to setup fully.
    const timeSrvMock: TimeSrv = {
      timeRangeForUrl() {
        const from = dateTime().subtract(1, 'h');
        const to = dateTime();
        return { from, to, raw: { from, to } };
      },
    } as any;
    const linkService = new LinkSrv(new TemplateSrv(), timeSrvMock);
    originalLinkSrv = getLinkSrv();
    setLinkSrv(linkService);
  });

  afterAll(() => {
    setLinkSrv(originalLinkSrv);
  });

  it('interpolates link from field', () => {
    const field: Field = {
      name: 'test field',
      type: FieldType.number,
      config: {
        links: [
          {
            title: 'title1',
            url: 'http://domain.com/${__value.raw}',
          },
          {
            title: 'title2',
            url: 'http://anotherdomain.sk/${__value.raw}',
          },
        ],
      },
      values: new ArrayVector([1, 2, 3]),
    };
    const links = getLinksFromLogsField(field, 2);
    expect(links.length).toBe(2);
    expect(links[0].href).toBe('http://domain.com/3');
    expect(links[1].href).toBe('http://anotherdomain.sk/3');
  });

  it('handles zero links', () => {
    const field: Field = {
      name: 'test field',
      type: FieldType.number,
      config: {},
      values: new ArrayVector([1, 2, 3]),
    };
    const links = getLinksFromLogsField(field, 2);
    expect(links.length).toBe(0);
  });

  it('links to items on the row', () => {
    const data = applyFieldOverrides({
      data: [
        toDataFrame({
          fields: [
            { name: 'Time', values: [1, 2, 3] },
            {
              name: 'Power',
              values: [100.2000001, 200, 300],
              config: {
                unit: 'kW',
                decimals: 3,
              },
            },
            {
              name: 'Last',
              values: ['a', 'b', 'c'],
              config: {
                links: [
                  {
                    title: 'By Name (full display)',
                    url: 'http://go/${__cell.Power}',
                  },
                  {
                    title: 'Numeric Value',
                    url: 'http://go/${__cell.Power.numeric}',
                  },
                  {
                    title: 'Text (no suffix)',
                    url: 'http://go/${__cell.Power.text}',
                  },
                  {
                    title: 'By Index',
                    url: 'http://go/${__cell.1}',
                  },
                  {
                    title: 'By array index (not yet supported)',
                    url: 'http://go/${__cell[1]}',
                  },
                  {
                    title: 'Unknown Field',
                    url: 'http://go/${__cell.XYZ}',
                  },
                ],
              },
            },
          ],
        }),
      ],
      fieldOptions: {
        defaults: {},
        overrides: [],
      },
      replaceVariables: (val: string) => val,
      timeZone: 'utc',
      theme: {} as GrafanaTheme,
      autoMinMax: true,
    })[0];

    const rowIndex = 0;
    const colIndex = data.fields.length - 1;
    const field = data.fields[colIndex];
    const fieldDisp: FieldDisplay = {
      name: 'hello',
      field: field.config,
      view: new DataFrameView(data),
      rowIndex,
      colIndex,
      display: field.display!(field.values.get(rowIndex)),
    };

    const supplier = getFieldLinksSupplier(fieldDisp);
    const links = supplier.getLinks({}).map(m => {
      return {
        title: m.title,
        href: m.href,
      };
    });
    expect(links).toMatchInlineSnapshot(`
      Array [
        Object {
          "href": "http://go/100.200 kW",
          "title": "By Name (full display)",
        },
        Object {
          "href": "http://go/100.2000001",
          "title": "Numeric Value",
        },
        Object {
          "href": "http://go/100.200",
          "title": "Text (no suffix)",
        },
        Object {
          "href": "http://go/100.200 kW",
          "title": "By Index",
        },
        Object {
          "href": "http://go/\${__cell[1]}",
          "title": "By array index (not yet supported)",
        },
        Object {
          "href": "http://go/\${__cell.XYZ}",
          "title": "Unknown Field",
        },
      ]
    `);
  });
});
