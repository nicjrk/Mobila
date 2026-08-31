# Mobila Studio: team and CNC workflow

## Access and client presentation

1. The configurator opens directly from the link, without login, as requested.
   A saved project link can be opened by the client and keeps the design
   editable.
2. The button with the eye icon opens **Client presentation**, which hides the
   work panels while keeping the design interactive for a clean demonstration.
3. Keep only the public publishable key in `VITE_SUPABASE_PUBLISHABLE_KEY`.
   Never place a service-role key in the browser or in a committed `.env` file.

## Production export

The CNC panel exports three complementary files:

- **DXF**: sheet boundaries and panel rectangles, one combined file or one
  file per plate.
- **Aspire manifest CSV**: a traceability table containing plate number,
  cabinet name, internal part ID, dimensions, grain, coordinates and nesting
  status.
- **Cut-list PDF**: a human-readable plate map and aggregated parts list.

The export is blocked when a part does not fit the configured usable sheet or
when the nesting validation finds duplicate IDs, overlap or out-of-bounds
geometry. Oversized parts are listed by cabinet and part label so the operator
can correct the design before export.

This application deliberately does not pretend that a DXF is already machine
code. Import the DXF into Aspire, confirm scale and origin, assign the correct
tools and operations, then save the toolpaths with the postprocessor belonging
to the actual CNC controller. The final file must be tested on a sacrificial
panel before production.
