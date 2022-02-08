import _ from 'lodash'

import { GraphQLQuery } from '@core/models/query'
import { GeneratorConfig, NullGenerationStrategy } from './config'
import { GraphQLField, GraphQLSchema, GraphQLType } from 'graphql'
import { unwrapFieldType } from './extractor'
import { generateArgsForField } from './fakeGenerator'
import {
  Parameter,
  QueryBuilder,
  queryBuilder,
  subSelectionBuilder,
} from './queryBuilder'

const DEFAULT_CONFIG: GeneratorConfig = {
  maxDepth: 5,
  nullGenerationStrategy: NullGenerationStrategy.NEVER_NULL,
  factories: {},
}

export type GenerationContext = {
  readonly path: string
  readonly depth: number
}

export function generateGraphQLQuery(
  field: GraphQLField<any, any, any>,
  schema: GraphQLSchema,
  config?: Partial<GeneratorConfig>,
): GraphQLQuery | null {
  const mergedConfig = Object.assign({}, DEFAULT_CONFIG, config)

  const initialBuilder = queryBuilder()

  const resultBuilder = buildField(
    initialBuilder,
    field,
    schema,
    mergedConfig,
    {
      depth: 1,
      path: field.name,
    },
  )

  if (resultBuilder === initialBuilder) {
    return null
  }

  return resultBuilder.build()
}

function generateField(
  type: GraphQLType,
  schema: GraphQLSchema,
  config: GeneratorConfig,
  context: GenerationContext,
): QueryBuilder | null {
  // Go no further
  if (context.depth >= config.maxDepth) {
    return null
  }

  if (isLeaf(type)) {
    // No more fields under
    return null
  }

  const builder = subSelectionBuilder()

  const fields = type.fields || []
  const finalBuilderWithAllFields = _.reduce(
    fields,
    (memo: QueryBuilder, field: Field) => {
      return buildField(memo, field, typesByName, config, {
        depth: context.depth,
        path: `${context.path}.${field.name}`,
      })
    },
    builder,
  )

  if (finalBuilderWithAllFields === builder) {
    // No change in the builder indicates that there were no leaf elements
    // and that no sub fields could be selected due to max depth being reached
    return null
  }

  return finalBuilderWithAllFields
}

function buildField(
  builder: QueryBuilder,
  field: GraphQLField<any, any, any>,
  schema: GraphQLSchema,
  config: GeneratorConfig,
  context: GenerationContext,
): QueryBuilder {
  const parameters: ReadonlyArray<Parameter> = generateArgsForField(
    field,
    schema,
    config,
    context,
  )

  const type = unwrapFieldType(field)
  const isLeafField = isLeaf(type)

  if (isLeafField) {
    // No sub selection is allowed since this is a leaf
    return builder.withField(field.name, parameters)
  }

  const generatedSubSelection = generateField(type, schema, config, {
    ...context,
    depth: context.depth + 1,
  })

  if (generatedSubSelection === null) {
    // No new field in the builder, as we can't select any sub field due to max depth
    return builder
  }

  // Modify the builder to select the sub field
  return builder.withField(field.name, parameters, generatedSubSelection)
}