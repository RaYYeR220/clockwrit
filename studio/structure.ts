import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Wallclock')
    .items([
      S.listItem()
        .title('Clock')
        .child(
          S.list()
            .title('Clock')
            .items([
              S.documentTypeListItem('zone').title('Time zones'),
              S.documentTypeListItem('ruleSegment').title('Clock regimes'),
            ]),
        ),
      S.listItem()
        .title('Calendar')
        .child(
          S.list()
            .title('Calendar')
            .items([
              S.documentTypeListItem('holiday').title('Holidays'),
              S.documentTypeListItem('weekendRegime').title('Weekend regimes'),
              S.documentTypeListItem('workdayOverride').title('Workday overrides'),
              S.documentTypeListItem('holidaySuspension').title('Holiday suspensions'),
            ]),
        ),
      S.listItem()
        .title('Instruments')
        .child(
          S.list()
            .title('Instruments by authority')
            .items(
              ['primary', 'secondary', 'community'].map((tier) =>
                S.listItem()
                  .title(tier[0]!.toUpperCase() + tier.slice(1))
                  .child(
                    S.documentList()
                      .title(`${tier} instruments`)
                      .filter('_type == "instrument" && authority == $tier')
                      .params({tier}),
                  ),
              ),
            ),
        ),
      S.listItem()
        .title('Rulings')
        .child(
          S.list()
            .title('Rulings')
            .items(
              [
                ['proposed', 'Awaiting review'],
                ['applied', 'Applied'],
                ['rejected', 'Sent back'],
              ].map(([status, title]) =>
                S.listItem()
                  .title(title!)
                  .child(S.documentList().title(title!).filter('_type == "ruling" && status == $status').params({status})),
              ),
            ),
        ),
      S.divider(),
      S.documentTypeListItem('jurisdiction').title('Jurisdictions'),
    ])
