import { readFileSync } from 'node:fs'
import path from 'node:path'
import { Ajv2020 } from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { parse } from 'yaml'

type Operation = { operationId?: string; responses?: Record<string, unknown> }
type OpenApiDocument = { paths: Record<string, Record<string, Operation>> }

const specificationPath = path.resolve(import.meta.dirname, '../../api/generated/openapi.yaml')
const document = parse(readFileSync(specificationPath, 'utf8')) as OpenApiDocument

const ajv = new Ajv2020({ strict: false, allErrors: true })
addFormats.default(ajv)
ajv.addSchema(document, 'openapi')

const pointer = (segment: string) => segment.replaceAll('~', '~0').replaceAll('/', '~1')

/** Находит в контракте операцию по методу и адресу запроса. */
function findOperation(method: string, url: string) {
  const requestPath = new URL(url, 'http://localhost').pathname
  for (const [template, operations] of Object.entries(document.paths)) {
    const pattern = new RegExp(`^${template.replaceAll(/\{[^/]+\}/g, '[^/]+')}$`)
    const operation = operations[method.toLowerCase()]
    if (operation && pattern.test(requestPath)) {
      return { template, operation }
    }
  }
  throw new Error(`В контракте нет операции ${method} ${requestPath}`)
}

/**
 * Проверяет ответ живого сервера по OpenAPI-контракту: код ответа должен быть
 * описан у операции, а тело должно соответствовать его схеме.
 */
export function assertMatchesContract(method: string, url: string, status: number, body: unknown) {
  const { template, operation } = findOperation(method, url)
  if (!operation.responses?.[status]) {
    throw new Error(`${operation.operationId}: код ${status} не описан в контракте`)
  }

  const schemaRef = [
    'openapi#/paths',
    pointer(template),
    method.toLowerCase(),
    'responses',
    String(status),
    'content',
    pointer('application/json'),
    'schema',
  ].join('/')
  const validate = ajv.getSchema(schemaRef)
  if (!validate) {
    throw new Error(`${operation.operationId}: у ответа ${status} нет JSON-схемы`)
  }
  if (!validate(body)) {
    throw new Error(
      `${operation.operationId}: ответ ${status} не соответствует контракту: ${ajv.errorsText(validate.errors)}`,
    )
  }
}
