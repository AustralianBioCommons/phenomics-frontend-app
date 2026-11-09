import React from 'react';
import { Alert, Anchor, Button, Drawer, Group, LoadingOverlay, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useGeneralGQLQuery } from '@gen3/core';
import {
  ErrorCard,
  type CellRendererFunctionProps,
  type TableDetailsPanelProps,
} from '@gen3/frontend';

/**
 * A1.6 drill-down: experiment -> second Guppy query on the `detail` index
 * (sample + rna_assay + expression_file metadata), joined on
 * experiment_submitter_id. Guppy/Arborist decide what each user gets back
 * (docs are stamped .../synthetic_dataset_1/detail). Zero rows => request-access
 * prompt; the wording never reveals whether detail exists (spec §4).
 *
 * NOTE: @gen3/frontend 0.12.44 ignores table.detailsConfig.panel (ExplorerTable
 * hard-codes QueryRowDetailsPanel), so the drill-down is opened from a cell
 * renderer (ExperimentDetailCell) instead. ExperimentDetailPanel is kept for
 * framework versions that honour detailsConfig.panel.
 */
const DETAIL_INDEX = 'detail';
const DEFAULT_FIELDS = [
  'submitter_id', 'platform', 'reference_genome', 'assay_date',
  'sample_submitter_id', 'genotype', 'biological_sex', 'tissue_organ',
  'expression_files { file_name data_type data_format }',
];

type DetailRow = Record<string, unknown> & {
  expression_files?: Array<Record<string, unknown>>;
};

const text = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

interface ExperimentDetailContentProps {
  experimentId: string;
  fields?: string[];
  requestAccessUrl?: string;
  onClose?: () => void;
}

export const ExperimentDetailContent = ({
  experimentId,
  fields = DEFAULT_FIELDS,
  requestAccessUrl,
  onClose,
}: ExperimentDetailContentProps) => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
      ${DETAIL_INDEX} (filter: $filter, first: 100, accessibility: accessible) {
        ${fields.join('\n')}
      }
    }`,
    variables: { filter: { AND: [{ IN: { experiment_submitter_id: [experimentId] } }] } },
  });

  if (isError) return <ErrorCard message="Error occurred while fetching assay detail" />;

  const rows: DetailRow[] = (data as { data?: Record<string, DetailRow[]> } | undefined)?.data?.[DETAIL_INDEX] ?? [];

  return (
    <Stack>
      <LoadingOverlay visible={isLoading} />
      <Text c="primary.4">Assay and sample detail for experiment {experimentId}</Text>
      {!isLoading && rows.length === 0 ? (
        <Alert color="gray" title="Detail not available">
          <Text size="sm">No assay or sample detail is available to you for this experiment.</Text>
          {requestAccessUrl ? (
            <Anchor href={requestAccessUrl} target="_blank">Request access</Anchor>
          ) : (
            <Text size="sm">To request access, contact the data owner.</Text>
          )}
        </Alert>
      ) : (
        <Table withColumnBorders striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Assay</Table.Th><Table.Th>Platform</Table.Th><Table.Th>Reference genome</Table.Th>
              <Table.Th>Sample</Table.Th><Table.Th>Genotype</Table.Th><Table.Th>Sex</Table.Th>
              <Table.Th>Tissue</Table.Th><Table.Th>Files</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={text(r.submitter_id)}>
                <Table.Td>{text(r.submitter_id)}</Table.Td>
                <Table.Td>{text(r.platform)}</Table.Td>
                <Table.Td>{text(r.reference_genome)}</Table.Td>
                <Table.Td>{text(r.sample_submitter_id)}</Table.Td>
                <Table.Td>{text(r.genotype)}</Table.Td>
                <Table.Td>{text(r.biological_sex)}</Table.Td>
                <Table.Td>{text(r.tissue_organ)}</Table.Td>
                <Table.Td>{(r.expression_files ?? []).map((f) => text(f.file_name)).join(', ')}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {onClose && (
        <Group justify="flex-end">
          <Button color="accent.5" onClick={onClose}>Close</Button>
        </Group>
      )}
    </Stack>
  );
};

/** Details-panel form (used only if the framework honours detailsConfig.panel). */
export const ExperimentDetailPanel = ({ id, tableConfig, onClose }: TableDetailsPanelProps) => {
  const params = (tableConfig.detailsConfig?.params ?? {}) as Record<string, unknown>;
  return (
    <ExperimentDetailContent
      experimentId={text(id)}
      fields={Array.isArray(params.fields) ? (params.fields as string[]) : undefined}
      requestAccessUrl={typeof params.requestAccessUrl === 'string' ? params.requestAccessUrl : undefined}
      onClose={onClose ? () => onClose(id) : undefined}
    />
  );
};

/**
 * Cell-renderer form: shows the experiment id as a link that opens a drawer with
 * the detail-index drill-down. Register as ('string', 'experimentDetail') and set
 * columns.submitter_id = { type: 'string', cellRenderFunction: 'experimentDetail' }.
 * Optional column params: { requestAccessUrl } (C4).
 */
export const ExperimentDetailCell = (
  { row }: CellRendererFunctionProps,
  params?: Record<string, unknown>,
) => {
  const [opened, { open, close }] = useDisclosure(false);
  const id = text((row?.original as Record<string, unknown> | undefined)?.submitter_id);
  if (!id) return <span />;
  const requestAccessUrl = typeof params?.requestAccessUrl === 'string' ? params.requestAccessUrl : undefined;
  return (
    <>
      <Anchor
        component="button"
        type="button"
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          open();
        }}
      >
        {id}
      </Anchor>
      <Drawer opened={opened} onClose={close} position="right" size="50%" title="Assay & sample detail">
        {opened && (
          <ExperimentDetailContent experimentId={id} requestAccessUrl={requestAccessUrl} onClose={close} />
        )}
      </Drawer>
    </>
  );
};

export default ExperimentDetailPanel;
