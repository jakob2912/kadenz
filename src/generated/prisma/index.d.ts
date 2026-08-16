
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Einstellung
 * Schlüssel-Wert-Ablage für Dinge, die App und MCP-Server gemeinsam brauchen.
 * 
 * Vor allem der Google-Refresh-Token: der liegt sonst nur in einem
 * httpOnly-Cookie, an das ein separater Prozess nicht herankommt. In der
 * Datenbank hat ihn genau eine Stelle, und der spätere Nacht-Job kann ihn
 * ebenfalls nutzen, ohne dass ein Browser offen sein muss.
 */
export type Einstellung = $Result.DefaultSelection<Prisma.$EinstellungPayload>
/**
 * Model Workout
 * 
 */
export type Workout = $Result.DefaultSelection<Prisma.$WorkoutPayload>
/**
 * Model SetLog
 * 
 */
export type SetLog = $Result.DefaultSelection<Prisma.$SetLogPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more Einstellungs
 * const einstellungs = await prisma.einstellung.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more Einstellungs
   * const einstellungs = await prisma.einstellung.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.PrismaClientConstructorArgs<ClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.einstellung`: Exposes CRUD operations for the **Einstellung** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Einstellungs
    * const einstellungs = await prisma.einstellung.findMany()
    * ```
    */
  get einstellung(): Prisma.EinstellungDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.workout`: Exposes CRUD operations for the **Workout** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Workouts
    * const workouts = await prisma.workout.findMany()
    * ```
    */
  get workout(): Prisma.WorkoutDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.setLog`: Exposes CRUD operations for the **SetLog** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SetLogs
    * const setLogs = await prisma.setLog.findMany()
    * ```
    */
  get setLog(): Prisma.SetLogDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.9.1
   * Query Engine version: e922089b7d7502aff4249d5da3420f6fa55fc6ad
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * Resolved type of the argument passed to the `PrismaClient` constructor.
   *
   * When called without a narrower options type (the common case), this resolves
   * to `PrismaClientOptions` directly, which produces a clear TypeScript error
   * message (`not assignable to parameter of type 'PrismaClientOptions'`) when
   * the argument is missing or incomplete. When the user supplies a narrower
   * options type (e.g. via a literal), it falls back to `Subset` to keep
   * filtering out unknown properties.
   */
  export type PrismaClientConstructorArgs<Options extends PrismaClientOptions> =
    [PrismaClientOptions] extends [Options] ? PrismaClientOptions : Subset<Options, PrismaClientOptions>;

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      ((Without<T, U> & U) | (Without<U, T> & T)) & object
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Einstellung: 'Einstellung',
    Workout: 'Workout',
    SetLog: 'SetLog'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "einstellung" | "workout" | "setLog"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Einstellung: {
        payload: Prisma.$EinstellungPayload<ExtArgs>
        fields: Prisma.EinstellungFieldRefs
        operations: {
          findUnique: {
            args: Prisma.EinstellungFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.EinstellungFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload>
          }
          findFirst: {
            args: Prisma.EinstellungFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.EinstellungFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload>
          }
          findMany: {
            args: Prisma.EinstellungFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload>[]
          }
          create: {
            args: Prisma.EinstellungCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload>
          }
          createMany: {
            args: Prisma.EinstellungCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.EinstellungCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload>[]
          }
          delete: {
            args: Prisma.EinstellungDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload>
          }
          update: {
            args: Prisma.EinstellungUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload>
          }
          deleteMany: {
            args: Prisma.EinstellungDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.EinstellungUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.EinstellungUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload>[]
          }
          upsert: {
            args: Prisma.EinstellungUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$EinstellungPayload>
          }
          aggregate: {
            args: Prisma.EinstellungAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateEinstellung>
          }
          groupBy: {
            args: Prisma.EinstellungGroupByArgs<ExtArgs>
            result: $Utils.Optional<EinstellungGroupByOutputType>[]
          }
          count: {
            args: Prisma.EinstellungCountArgs<ExtArgs>
            result: $Utils.Optional<EinstellungCountAggregateOutputType> | number
          }
        }
      }
      Workout: {
        payload: Prisma.$WorkoutPayload<ExtArgs>
        fields: Prisma.WorkoutFieldRefs
        operations: {
          findUnique: {
            args: Prisma.WorkoutFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.WorkoutFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload>
          }
          findFirst: {
            args: Prisma.WorkoutFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.WorkoutFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload>
          }
          findMany: {
            args: Prisma.WorkoutFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload>[]
          }
          create: {
            args: Prisma.WorkoutCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload>
          }
          createMany: {
            args: Prisma.WorkoutCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.WorkoutCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload>[]
          }
          delete: {
            args: Prisma.WorkoutDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload>
          }
          update: {
            args: Prisma.WorkoutUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload>
          }
          deleteMany: {
            args: Prisma.WorkoutDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.WorkoutUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.WorkoutUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload>[]
          }
          upsert: {
            args: Prisma.WorkoutUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$WorkoutPayload>
          }
          aggregate: {
            args: Prisma.WorkoutAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateWorkout>
          }
          groupBy: {
            args: Prisma.WorkoutGroupByArgs<ExtArgs>
            result: $Utils.Optional<WorkoutGroupByOutputType>[]
          }
          count: {
            args: Prisma.WorkoutCountArgs<ExtArgs>
            result: $Utils.Optional<WorkoutCountAggregateOutputType> | number
          }
        }
      }
      SetLog: {
        payload: Prisma.$SetLogPayload<ExtArgs>
        fields: Prisma.SetLogFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SetLogFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SetLogFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload>
          }
          findFirst: {
            args: Prisma.SetLogFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SetLogFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload>
          }
          findMany: {
            args: Prisma.SetLogFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload>[]
          }
          create: {
            args: Prisma.SetLogCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload>
          }
          createMany: {
            args: Prisma.SetLogCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SetLogCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload>[]
          }
          delete: {
            args: Prisma.SetLogDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload>
          }
          update: {
            args: Prisma.SetLogUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload>
          }
          deleteMany: {
            args: Prisma.SetLogDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SetLogUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SetLogUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload>[]
          }
          upsert: {
            args: Prisma.SetLogUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SetLogPayload>
          }
          aggregate: {
            args: Prisma.SetLogAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSetLog>
          }
          groupBy: {
            args: Prisma.SetLogGroupByArgs<ExtArgs>
            result: $Utils.Optional<SetLogGroupByOutputType>[]
          }
          count: {
            args: Prisma.SetLogCountArgs<ExtArgs>
            result: $Utils.Optional<SetLogCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * A driver adapter that PrismaClient uses to connect to your database, such as the ones provided by `@prisma/adapter-pg`, `@prisma/adapter-libsql`, `@prisma/adapter-planetscale`, etc.
     * 
     * A driver adapter is **required** unless you connect to your database through Prisma Accelerate (in which case use `accelerateUrl` instead).
     * 
     * Learn more: https://pris.ly/d/driver-adapters
     * 
     * @example
     * ```ts
     * import { PrismaPg } from '@prisma/adapter-pg'
     * import { PrismaClient } from './generated/prisma/client'
     * 
     * const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
     * const prisma = new PrismaClient({ adapter })
     * ```
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * The Prisma Accelerate connection URL. Use this option to connect to your database through Prisma Accelerate instead of using a driver adapter to connect directly.
     * 
     * Learn more: https://pris.ly/d/accelerate
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    einstellung?: EinstellungOmit
    workout?: WorkoutOmit
    setLog?: SetLogOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type WorkoutCountOutputType
   */

  export type WorkoutCountOutputType = {
    sets: number
  }

  export type WorkoutCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    sets?: boolean | WorkoutCountOutputTypeCountSetsArgs
  }

  // Custom InputTypes
  /**
   * WorkoutCountOutputType without action
   */
  export type WorkoutCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the WorkoutCountOutputType
     */
    select?: WorkoutCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * WorkoutCountOutputType without action
   */
  export type WorkoutCountOutputTypeCountSetsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SetLogWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Einstellung
   */

  export type AggregateEinstellung = {
    _count: EinstellungCountAggregateOutputType | null
    _min: EinstellungMinAggregateOutputType | null
    _max: EinstellungMaxAggregateOutputType | null
  }

  export type EinstellungMinAggregateOutputType = {
    schluessel: string | null
    wert: string | null
    aktualisiert: Date | null
  }

  export type EinstellungMaxAggregateOutputType = {
    schluessel: string | null
    wert: string | null
    aktualisiert: Date | null
  }

  export type EinstellungCountAggregateOutputType = {
    schluessel: number
    wert: number
    aktualisiert: number
    _all: number
  }


  export type EinstellungMinAggregateInputType = {
    schluessel?: true
    wert?: true
    aktualisiert?: true
  }

  export type EinstellungMaxAggregateInputType = {
    schluessel?: true
    wert?: true
    aktualisiert?: true
  }

  export type EinstellungCountAggregateInputType = {
    schluessel?: true
    wert?: true
    aktualisiert?: true
    _all?: true
  }

  export type EinstellungAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Einstellung to aggregate.
     */
    where?: EinstellungWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Einstellungs to fetch.
     */
    orderBy?: EinstellungOrderByWithRelationInput | EinstellungOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: EinstellungWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Einstellungs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Einstellungs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Einstellungs
    **/
    _count?: true | EinstellungCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: EinstellungMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: EinstellungMaxAggregateInputType
  }

  export type GetEinstellungAggregateType<T extends EinstellungAggregateArgs> = {
        [P in keyof T & keyof AggregateEinstellung]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateEinstellung[P]>
      : GetScalarType<T[P], AggregateEinstellung[P]>
  }




  export type EinstellungGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: EinstellungWhereInput
    orderBy?: EinstellungOrderByWithAggregationInput | EinstellungOrderByWithAggregationInput[]
    by: EinstellungScalarFieldEnum[] | EinstellungScalarFieldEnum
    having?: EinstellungScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: EinstellungCountAggregateInputType | true
    _min?: EinstellungMinAggregateInputType
    _max?: EinstellungMaxAggregateInputType
  }

  export type EinstellungGroupByOutputType = {
    schluessel: string
    wert: string
    aktualisiert: Date
    _count: EinstellungCountAggregateOutputType | null
    _min: EinstellungMinAggregateOutputType | null
    _max: EinstellungMaxAggregateOutputType | null
  }

  type GetEinstellungGroupByPayload<T extends EinstellungGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<EinstellungGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof EinstellungGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], EinstellungGroupByOutputType[P]>
            : GetScalarType<T[P], EinstellungGroupByOutputType[P]>
        }
      >
    >


  export type EinstellungSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    schluessel?: boolean
    wert?: boolean
    aktualisiert?: boolean
  }, ExtArgs["result"]["einstellung"]>

  export type EinstellungSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    schluessel?: boolean
    wert?: boolean
    aktualisiert?: boolean
  }, ExtArgs["result"]["einstellung"]>

  export type EinstellungSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    schluessel?: boolean
    wert?: boolean
    aktualisiert?: boolean
  }, ExtArgs["result"]["einstellung"]>

  export type EinstellungSelectScalar = {
    schluessel?: boolean
    wert?: boolean
    aktualisiert?: boolean
  }

  export type EinstellungOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"schluessel" | "wert" | "aktualisiert", ExtArgs["result"]["einstellung"]>

  export type $EinstellungPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Einstellung"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      schluessel: string
      wert: string
      aktualisiert: Date
    }, ExtArgs["result"]["einstellung"]>
    composites: {}
  }

  type EinstellungGetPayload<S extends boolean | null | undefined | EinstellungDefaultArgs> = $Result.GetResult<Prisma.$EinstellungPayload, S>

  type EinstellungCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<EinstellungFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: EinstellungCountAggregateInputType | true
    }

  export interface EinstellungDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Einstellung'], meta: { name: 'Einstellung' } }
    /**
     * Find zero or one Einstellung that matches the filter.
     * @param {EinstellungFindUniqueArgs} args - Arguments to find a Einstellung
     * @example
     * // Get one Einstellung
     * const einstellung = await prisma.einstellung.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends EinstellungFindUniqueArgs>(args: SelectSubset<T, EinstellungFindUniqueArgs<ExtArgs>>): Prisma__EinstellungClient<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Einstellung that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {EinstellungFindUniqueOrThrowArgs} args - Arguments to find a Einstellung
     * @example
     * // Get one Einstellung
     * const einstellung = await prisma.einstellung.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends EinstellungFindUniqueOrThrowArgs>(args: SelectSubset<T, EinstellungFindUniqueOrThrowArgs<ExtArgs>>): Prisma__EinstellungClient<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Einstellung that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EinstellungFindFirstArgs} args - Arguments to find a Einstellung
     * @example
     * // Get one Einstellung
     * const einstellung = await prisma.einstellung.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends EinstellungFindFirstArgs>(args?: SelectSubset<T, EinstellungFindFirstArgs<ExtArgs>>): Prisma__EinstellungClient<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Einstellung that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EinstellungFindFirstOrThrowArgs} args - Arguments to find a Einstellung
     * @example
     * // Get one Einstellung
     * const einstellung = await prisma.einstellung.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends EinstellungFindFirstOrThrowArgs>(args?: SelectSubset<T, EinstellungFindFirstOrThrowArgs<ExtArgs>>): Prisma__EinstellungClient<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Einstellungs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EinstellungFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Einstellungs
     * const einstellungs = await prisma.einstellung.findMany()
     * 
     * // Get first 10 Einstellungs
     * const einstellungs = await prisma.einstellung.findMany({ take: 10 })
     * 
     * // Only select the `schluessel`
     * const einstellungWithSchluesselOnly = await prisma.einstellung.findMany({ select: { schluessel: true } })
     * 
     */
    findMany<T extends EinstellungFindManyArgs>(args?: SelectSubset<T, EinstellungFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Einstellung.
     * @param {EinstellungCreateArgs} args - Arguments to create a Einstellung.
     * @example
     * // Create one Einstellung
     * const Einstellung = await prisma.einstellung.create({
     *   data: {
     *     // ... data to create a Einstellung
     *   }
     * })
     * 
     */
    create<T extends EinstellungCreateArgs>(args: SelectSubset<T, EinstellungCreateArgs<ExtArgs>>): Prisma__EinstellungClient<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Einstellungs.
     * @param {EinstellungCreateManyArgs} args - Arguments to create many Einstellungs.
     * @example
     * // Create many Einstellungs
     * const einstellung = await prisma.einstellung.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends EinstellungCreateManyArgs>(args?: SelectSubset<T, EinstellungCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Einstellungs and returns the data saved in the database.
     * @param {EinstellungCreateManyAndReturnArgs} args - Arguments to create many Einstellungs.
     * @example
     * // Create many Einstellungs
     * const einstellung = await prisma.einstellung.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Einstellungs and only return the `schluessel`
     * const einstellungWithSchluesselOnly = await prisma.einstellung.createManyAndReturn({
     *   select: { schluessel: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends EinstellungCreateManyAndReturnArgs>(args?: SelectSubset<T, EinstellungCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Einstellung.
     * @param {EinstellungDeleteArgs} args - Arguments to delete one Einstellung.
     * @example
     * // Delete one Einstellung
     * const Einstellung = await prisma.einstellung.delete({
     *   where: {
     *     // ... filter to delete one Einstellung
     *   }
     * })
     * 
     */
    delete<T extends EinstellungDeleteArgs>(args: SelectSubset<T, EinstellungDeleteArgs<ExtArgs>>): Prisma__EinstellungClient<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Einstellung.
     * @param {EinstellungUpdateArgs} args - Arguments to update one Einstellung.
     * @example
     * // Update one Einstellung
     * const einstellung = await prisma.einstellung.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends EinstellungUpdateArgs>(args: SelectSubset<T, EinstellungUpdateArgs<ExtArgs>>): Prisma__EinstellungClient<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Einstellungs.
     * @param {EinstellungDeleteManyArgs} args - Arguments to filter Einstellungs to delete.
     * @example
     * // Delete a few Einstellungs
     * const { count } = await prisma.einstellung.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends EinstellungDeleteManyArgs>(args?: SelectSubset<T, EinstellungDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Einstellungs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EinstellungUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Einstellungs
     * const einstellung = await prisma.einstellung.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends EinstellungUpdateManyArgs>(args: SelectSubset<T, EinstellungUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Einstellungs and returns the data updated in the database.
     * @param {EinstellungUpdateManyAndReturnArgs} args - Arguments to update many Einstellungs.
     * @example
     * // Update many Einstellungs
     * const einstellung = await prisma.einstellung.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Einstellungs and only return the `schluessel`
     * const einstellungWithSchluesselOnly = await prisma.einstellung.updateManyAndReturn({
     *   select: { schluessel: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends EinstellungUpdateManyAndReturnArgs>(args: SelectSubset<T, EinstellungUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Einstellung.
     * @param {EinstellungUpsertArgs} args - Arguments to update or create a Einstellung.
     * @example
     * // Update or create a Einstellung
     * const einstellung = await prisma.einstellung.upsert({
     *   create: {
     *     // ... data to create a Einstellung
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Einstellung we want to update
     *   }
     * })
     */
    upsert<T extends EinstellungUpsertArgs>(args: SelectSubset<T, EinstellungUpsertArgs<ExtArgs>>): Prisma__EinstellungClient<$Result.GetResult<Prisma.$EinstellungPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Einstellungs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EinstellungCountArgs} args - Arguments to filter Einstellungs to count.
     * @example
     * // Count the number of Einstellungs
     * const count = await prisma.einstellung.count({
     *   where: {
     *     // ... the filter for the Einstellungs we want to count
     *   }
     * })
    **/
    count<T extends EinstellungCountArgs>(
      args?: Subset<T, EinstellungCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], EinstellungCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Einstellung.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EinstellungAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends EinstellungAggregateArgs>(args: Subset<T, EinstellungAggregateArgs>): Prisma.PrismaPromise<GetEinstellungAggregateType<T>>

    /**
     * Group by Einstellung.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {EinstellungGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends EinstellungGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: EinstellungGroupByArgs['orderBy'] }
        : { orderBy?: EinstellungGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, EinstellungGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetEinstellungGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Einstellung model
   */
  readonly fields: EinstellungFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Einstellung.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__EinstellungClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Einstellung model
   */
  interface EinstellungFieldRefs {
    readonly schluessel: FieldRef<"Einstellung", 'String'>
    readonly wert: FieldRef<"Einstellung", 'String'>
    readonly aktualisiert: FieldRef<"Einstellung", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Einstellung findUnique
   */
  export type EinstellungFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * Filter, which Einstellung to fetch.
     */
    where: EinstellungWhereUniqueInput
  }

  /**
   * Einstellung findUniqueOrThrow
   */
  export type EinstellungFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * Filter, which Einstellung to fetch.
     */
    where: EinstellungWhereUniqueInput
  }

  /**
   * Einstellung findFirst
   */
  export type EinstellungFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * Filter, which Einstellung to fetch.
     */
    where?: EinstellungWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Einstellungs to fetch.
     */
    orderBy?: EinstellungOrderByWithRelationInput | EinstellungOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Einstellungs.
     */
    cursor?: EinstellungWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Einstellungs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Einstellungs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Einstellungs.
     */
    distinct?: EinstellungScalarFieldEnum | EinstellungScalarFieldEnum[]
  }

  /**
   * Einstellung findFirstOrThrow
   */
  export type EinstellungFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * Filter, which Einstellung to fetch.
     */
    where?: EinstellungWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Einstellungs to fetch.
     */
    orderBy?: EinstellungOrderByWithRelationInput | EinstellungOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Einstellungs.
     */
    cursor?: EinstellungWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Einstellungs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Einstellungs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Einstellungs.
     */
    distinct?: EinstellungScalarFieldEnum | EinstellungScalarFieldEnum[]
  }

  /**
   * Einstellung findMany
   */
  export type EinstellungFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * Filter, which Einstellungs to fetch.
     */
    where?: EinstellungWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Einstellungs to fetch.
     */
    orderBy?: EinstellungOrderByWithRelationInput | EinstellungOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Einstellungs.
     */
    cursor?: EinstellungWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Einstellungs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Einstellungs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Einstellungs.
     */
    distinct?: EinstellungScalarFieldEnum | EinstellungScalarFieldEnum[]
  }

  /**
   * Einstellung create
   */
  export type EinstellungCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * The data needed to create a Einstellung.
     */
    data: XOR<EinstellungCreateInput, EinstellungUncheckedCreateInput>
  }

  /**
   * Einstellung createMany
   */
  export type EinstellungCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Einstellungs.
     */
    data: EinstellungCreateManyInput | EinstellungCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Einstellung createManyAndReturn
   */
  export type EinstellungCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * The data used to create many Einstellungs.
     */
    data: EinstellungCreateManyInput | EinstellungCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Einstellung update
   */
  export type EinstellungUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * The data needed to update a Einstellung.
     */
    data: XOR<EinstellungUpdateInput, EinstellungUncheckedUpdateInput>
    /**
     * Choose, which Einstellung to update.
     */
    where: EinstellungWhereUniqueInput
  }

  /**
   * Einstellung updateMany
   */
  export type EinstellungUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Einstellungs.
     */
    data: XOR<EinstellungUpdateManyMutationInput, EinstellungUncheckedUpdateManyInput>
    /**
     * Filter which Einstellungs to update
     */
    where?: EinstellungWhereInput
    /**
     * Limit how many Einstellungs to update.
     */
    limit?: number
  }

  /**
   * Einstellung updateManyAndReturn
   */
  export type EinstellungUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * The data used to update Einstellungs.
     */
    data: XOR<EinstellungUpdateManyMutationInput, EinstellungUncheckedUpdateManyInput>
    /**
     * Filter which Einstellungs to update
     */
    where?: EinstellungWhereInput
    /**
     * Limit how many Einstellungs to update.
     */
    limit?: number
  }

  /**
   * Einstellung upsert
   */
  export type EinstellungUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * The filter to search for the Einstellung to update in case it exists.
     */
    where: EinstellungWhereUniqueInput
    /**
     * In case the Einstellung found by the `where` argument doesn't exist, create a new Einstellung with this data.
     */
    create: XOR<EinstellungCreateInput, EinstellungUncheckedCreateInput>
    /**
     * In case the Einstellung was found with the provided `where` argument, update it with this data.
     */
    update: XOR<EinstellungUpdateInput, EinstellungUncheckedUpdateInput>
  }

  /**
   * Einstellung delete
   */
  export type EinstellungDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
    /**
     * Filter which Einstellung to delete.
     */
    where: EinstellungWhereUniqueInput
  }

  /**
   * Einstellung deleteMany
   */
  export type EinstellungDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Einstellungs to delete
     */
    where?: EinstellungWhereInput
    /**
     * Limit how many Einstellungs to delete.
     */
    limit?: number
  }

  /**
   * Einstellung without action
   */
  export type EinstellungDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Einstellung
     */
    select?: EinstellungSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Einstellung
     */
    omit?: EinstellungOmit<ExtArgs> | null
  }


  /**
   * Model Workout
   */

  export type AggregateWorkout = {
    _count: WorkoutCountAggregateOutputType | null
    _min: WorkoutMinAggregateOutputType | null
    _max: WorkoutMaxAggregateOutputType | null
  }

  export type WorkoutMinAggregateOutputType = {
    id: string | null
    date: Date | null
    kind: string | null
    startedAt: Date | null
    finishedAt: Date | null
    note: string | null
  }

  export type WorkoutMaxAggregateOutputType = {
    id: string | null
    date: Date | null
    kind: string | null
    startedAt: Date | null
    finishedAt: Date | null
    note: string | null
  }

  export type WorkoutCountAggregateOutputType = {
    id: number
    date: number
    kind: number
    startedAt: number
    finishedAt: number
    note: number
    _all: number
  }


  export type WorkoutMinAggregateInputType = {
    id?: true
    date?: true
    kind?: true
    startedAt?: true
    finishedAt?: true
    note?: true
  }

  export type WorkoutMaxAggregateInputType = {
    id?: true
    date?: true
    kind?: true
    startedAt?: true
    finishedAt?: true
    note?: true
  }

  export type WorkoutCountAggregateInputType = {
    id?: true
    date?: true
    kind?: true
    startedAt?: true
    finishedAt?: true
    note?: true
    _all?: true
  }

  export type WorkoutAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Workout to aggregate.
     */
    where?: WorkoutWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Workouts to fetch.
     */
    orderBy?: WorkoutOrderByWithRelationInput | WorkoutOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: WorkoutWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Workouts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Workouts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Workouts
    **/
    _count?: true | WorkoutCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: WorkoutMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: WorkoutMaxAggregateInputType
  }

  export type GetWorkoutAggregateType<T extends WorkoutAggregateArgs> = {
        [P in keyof T & keyof AggregateWorkout]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateWorkout[P]>
      : GetScalarType<T[P], AggregateWorkout[P]>
  }




  export type WorkoutGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: WorkoutWhereInput
    orderBy?: WorkoutOrderByWithAggregationInput | WorkoutOrderByWithAggregationInput[]
    by: WorkoutScalarFieldEnum[] | WorkoutScalarFieldEnum
    having?: WorkoutScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: WorkoutCountAggregateInputType | true
    _min?: WorkoutMinAggregateInputType
    _max?: WorkoutMaxAggregateInputType
  }

  export type WorkoutGroupByOutputType = {
    id: string
    date: Date
    kind: string
    startedAt: Date
    finishedAt: Date | null
    note: string | null
    _count: WorkoutCountAggregateOutputType | null
    _min: WorkoutMinAggregateOutputType | null
    _max: WorkoutMaxAggregateOutputType | null
  }

  type GetWorkoutGroupByPayload<T extends WorkoutGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<WorkoutGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof WorkoutGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], WorkoutGroupByOutputType[P]>
            : GetScalarType<T[P], WorkoutGroupByOutputType[P]>
        }
      >
    >


  export type WorkoutSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    date?: boolean
    kind?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    note?: boolean
    sets?: boolean | Workout$setsArgs<ExtArgs>
    _count?: boolean | WorkoutCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["workout"]>

  export type WorkoutSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    date?: boolean
    kind?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    note?: boolean
  }, ExtArgs["result"]["workout"]>

  export type WorkoutSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    date?: boolean
    kind?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    note?: boolean
  }, ExtArgs["result"]["workout"]>

  export type WorkoutSelectScalar = {
    id?: boolean
    date?: boolean
    kind?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    note?: boolean
  }

  export type WorkoutOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "date" | "kind" | "startedAt" | "finishedAt" | "note", ExtArgs["result"]["workout"]>
  export type WorkoutInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    sets?: boolean | Workout$setsArgs<ExtArgs>
    _count?: boolean | WorkoutCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type WorkoutIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type WorkoutIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $WorkoutPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Workout"
    objects: {
      sets: Prisma.$SetLogPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      /**
       * Trainingstag in Ortszeit — nicht der Zeitstempel, sonst rutscht ein
       * spätes Training über Mitternacht auf den Folgetag.
       */
      date: Date
      /**
       * "push" (anterior) oder "pull" (posterior) — Jakobs eigene Einteilung
       */
      kind: string
      startedAt: Date
      finishedAt: Date | null
      note: string | null
    }, ExtArgs["result"]["workout"]>
    composites: {}
  }

  type WorkoutGetPayload<S extends boolean | null | undefined | WorkoutDefaultArgs> = $Result.GetResult<Prisma.$WorkoutPayload, S>

  type WorkoutCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<WorkoutFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: WorkoutCountAggregateInputType | true
    }

  export interface WorkoutDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Workout'], meta: { name: 'Workout' } }
    /**
     * Find zero or one Workout that matches the filter.
     * @param {WorkoutFindUniqueArgs} args - Arguments to find a Workout
     * @example
     * // Get one Workout
     * const workout = await prisma.workout.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends WorkoutFindUniqueArgs>(args: SelectSubset<T, WorkoutFindUniqueArgs<ExtArgs>>): Prisma__WorkoutClient<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Workout that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {WorkoutFindUniqueOrThrowArgs} args - Arguments to find a Workout
     * @example
     * // Get one Workout
     * const workout = await prisma.workout.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends WorkoutFindUniqueOrThrowArgs>(args: SelectSubset<T, WorkoutFindUniqueOrThrowArgs<ExtArgs>>): Prisma__WorkoutClient<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Workout that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkoutFindFirstArgs} args - Arguments to find a Workout
     * @example
     * // Get one Workout
     * const workout = await prisma.workout.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends WorkoutFindFirstArgs>(args?: SelectSubset<T, WorkoutFindFirstArgs<ExtArgs>>): Prisma__WorkoutClient<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Workout that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkoutFindFirstOrThrowArgs} args - Arguments to find a Workout
     * @example
     * // Get one Workout
     * const workout = await prisma.workout.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends WorkoutFindFirstOrThrowArgs>(args?: SelectSubset<T, WorkoutFindFirstOrThrowArgs<ExtArgs>>): Prisma__WorkoutClient<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Workouts that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkoutFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Workouts
     * const workouts = await prisma.workout.findMany()
     * 
     * // Get first 10 Workouts
     * const workouts = await prisma.workout.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const workoutWithIdOnly = await prisma.workout.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends WorkoutFindManyArgs>(args?: SelectSubset<T, WorkoutFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Workout.
     * @param {WorkoutCreateArgs} args - Arguments to create a Workout.
     * @example
     * // Create one Workout
     * const Workout = await prisma.workout.create({
     *   data: {
     *     // ... data to create a Workout
     *   }
     * })
     * 
     */
    create<T extends WorkoutCreateArgs>(args: SelectSubset<T, WorkoutCreateArgs<ExtArgs>>): Prisma__WorkoutClient<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Workouts.
     * @param {WorkoutCreateManyArgs} args - Arguments to create many Workouts.
     * @example
     * // Create many Workouts
     * const workout = await prisma.workout.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends WorkoutCreateManyArgs>(args?: SelectSubset<T, WorkoutCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Workouts and returns the data saved in the database.
     * @param {WorkoutCreateManyAndReturnArgs} args - Arguments to create many Workouts.
     * @example
     * // Create many Workouts
     * const workout = await prisma.workout.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Workouts and only return the `id`
     * const workoutWithIdOnly = await prisma.workout.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends WorkoutCreateManyAndReturnArgs>(args?: SelectSubset<T, WorkoutCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Workout.
     * @param {WorkoutDeleteArgs} args - Arguments to delete one Workout.
     * @example
     * // Delete one Workout
     * const Workout = await prisma.workout.delete({
     *   where: {
     *     // ... filter to delete one Workout
     *   }
     * })
     * 
     */
    delete<T extends WorkoutDeleteArgs>(args: SelectSubset<T, WorkoutDeleteArgs<ExtArgs>>): Prisma__WorkoutClient<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Workout.
     * @param {WorkoutUpdateArgs} args - Arguments to update one Workout.
     * @example
     * // Update one Workout
     * const workout = await prisma.workout.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends WorkoutUpdateArgs>(args: SelectSubset<T, WorkoutUpdateArgs<ExtArgs>>): Prisma__WorkoutClient<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Workouts.
     * @param {WorkoutDeleteManyArgs} args - Arguments to filter Workouts to delete.
     * @example
     * // Delete a few Workouts
     * const { count } = await prisma.workout.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends WorkoutDeleteManyArgs>(args?: SelectSubset<T, WorkoutDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Workouts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkoutUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Workouts
     * const workout = await prisma.workout.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends WorkoutUpdateManyArgs>(args: SelectSubset<T, WorkoutUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Workouts and returns the data updated in the database.
     * @param {WorkoutUpdateManyAndReturnArgs} args - Arguments to update many Workouts.
     * @example
     * // Update many Workouts
     * const workout = await prisma.workout.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Workouts and only return the `id`
     * const workoutWithIdOnly = await prisma.workout.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends WorkoutUpdateManyAndReturnArgs>(args: SelectSubset<T, WorkoutUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Workout.
     * @param {WorkoutUpsertArgs} args - Arguments to update or create a Workout.
     * @example
     * // Update or create a Workout
     * const workout = await prisma.workout.upsert({
     *   create: {
     *     // ... data to create a Workout
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Workout we want to update
     *   }
     * })
     */
    upsert<T extends WorkoutUpsertArgs>(args: SelectSubset<T, WorkoutUpsertArgs<ExtArgs>>): Prisma__WorkoutClient<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Workouts.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkoutCountArgs} args - Arguments to filter Workouts to count.
     * @example
     * // Count the number of Workouts
     * const count = await prisma.workout.count({
     *   where: {
     *     // ... the filter for the Workouts we want to count
     *   }
     * })
    **/
    count<T extends WorkoutCountArgs>(
      args?: Subset<T, WorkoutCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], WorkoutCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Workout.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkoutAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends WorkoutAggregateArgs>(args: Subset<T, WorkoutAggregateArgs>): Prisma.PrismaPromise<GetWorkoutAggregateType<T>>

    /**
     * Group by Workout.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {WorkoutGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends WorkoutGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: WorkoutGroupByArgs['orderBy'] }
        : { orderBy?: WorkoutGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, WorkoutGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetWorkoutGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Workout model
   */
  readonly fields: WorkoutFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Workout.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__WorkoutClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    sets<T extends Workout$setsArgs<ExtArgs> = {}>(args?: Subset<T, Workout$setsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Workout model
   */
  interface WorkoutFieldRefs {
    readonly id: FieldRef<"Workout", 'String'>
    readonly date: FieldRef<"Workout", 'DateTime'>
    readonly kind: FieldRef<"Workout", 'String'>
    readonly startedAt: FieldRef<"Workout", 'DateTime'>
    readonly finishedAt: FieldRef<"Workout", 'DateTime'>
    readonly note: FieldRef<"Workout", 'String'>
  }
    

  // Custom InputTypes
  /**
   * Workout findUnique
   */
  export type WorkoutFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkoutInclude<ExtArgs> | null
    /**
     * Filter, which Workout to fetch.
     */
    where: WorkoutWhereUniqueInput
  }

  /**
   * Workout findUniqueOrThrow
   */
  export type WorkoutFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkoutInclude<ExtArgs> | null
    /**
     * Filter, which Workout to fetch.
     */
    where: WorkoutWhereUniqueInput
  }

  /**
   * Workout findFirst
   */
  export type WorkoutFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkoutInclude<ExtArgs> | null
    /**
     * Filter, which Workout to fetch.
     */
    where?: WorkoutWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Workouts to fetch.
     */
    orderBy?: WorkoutOrderByWithRelationInput | WorkoutOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Workouts.
     */
    cursor?: WorkoutWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Workouts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Workouts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Workouts.
     */
    distinct?: WorkoutScalarFieldEnum | WorkoutScalarFieldEnum[]
  }

  /**
   * Workout findFirstOrThrow
   */
  export type WorkoutFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkoutInclude<ExtArgs> | null
    /**
     * Filter, which Workout to fetch.
     */
    where?: WorkoutWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Workouts to fetch.
     */
    orderBy?: WorkoutOrderByWithRelationInput | WorkoutOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Workouts.
     */
    cursor?: WorkoutWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Workouts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Workouts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Workouts.
     */
    distinct?: WorkoutScalarFieldEnum | WorkoutScalarFieldEnum[]
  }

  /**
   * Workout findMany
   */
  export type WorkoutFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkoutInclude<ExtArgs> | null
    /**
     * Filter, which Workouts to fetch.
     */
    where?: WorkoutWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Workouts to fetch.
     */
    orderBy?: WorkoutOrderByWithRelationInput | WorkoutOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Workouts.
     */
    cursor?: WorkoutWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Workouts from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Workouts.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Workouts.
     */
    distinct?: WorkoutScalarFieldEnum | WorkoutScalarFieldEnum[]
  }

  /**
   * Workout create
   */
  export type WorkoutCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkoutInclude<ExtArgs> | null
    /**
     * The data needed to create a Workout.
     */
    data: XOR<WorkoutCreateInput, WorkoutUncheckedCreateInput>
  }

  /**
   * Workout createMany
   */
  export type WorkoutCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Workouts.
     */
    data: WorkoutCreateManyInput | WorkoutCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Workout createManyAndReturn
   */
  export type WorkoutCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * The data used to create many Workouts.
     */
    data: WorkoutCreateManyInput | WorkoutCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Workout update
   */
  export type WorkoutUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkoutInclude<ExtArgs> | null
    /**
     * The data needed to update a Workout.
     */
    data: XOR<WorkoutUpdateInput, WorkoutUncheckedUpdateInput>
    /**
     * Choose, which Workout to update.
     */
    where: WorkoutWhereUniqueInput
  }

  /**
   * Workout updateMany
   */
  export type WorkoutUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Workouts.
     */
    data: XOR<WorkoutUpdateManyMutationInput, WorkoutUncheckedUpdateManyInput>
    /**
     * Filter which Workouts to update
     */
    where?: WorkoutWhereInput
    /**
     * Limit how many Workouts to update.
     */
    limit?: number
  }

  /**
   * Workout updateManyAndReturn
   */
  export type WorkoutUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * The data used to update Workouts.
     */
    data: XOR<WorkoutUpdateManyMutationInput, WorkoutUncheckedUpdateManyInput>
    /**
     * Filter which Workouts to update
     */
    where?: WorkoutWhereInput
    /**
     * Limit how many Workouts to update.
     */
    limit?: number
  }

  /**
   * Workout upsert
   */
  export type WorkoutUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkoutInclude<ExtArgs> | null
    /**
     * The filter to search for the Workout to update in case it exists.
     */
    where: WorkoutWhereUniqueInput
    /**
     * In case the Workout found by the `where` argument doesn't exist, create a new Workout with this data.
     */
    create: XOR<WorkoutCreateInput, WorkoutUncheckedCreateInput>
    /**
     * In case the Workout was found with the provided `where` argument, update it with this data.
     */
    update: XOR<WorkoutUpdateInput, WorkoutUncheckedUpdateInput>
  }

  /**
   * Workout delete
   */
  export type WorkoutDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkoutInclude<ExtArgs> | null
    /**
     * Filter which Workout to delete.
     */
    where: WorkoutWhereUniqueInput
  }

  /**
   * Workout deleteMany
   */
  export type WorkoutDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Workouts to delete
     */
    where?: WorkoutWhereInput
    /**
     * Limit how many Workouts to delete.
     */
    limit?: number
  }

  /**
   * Workout.sets
   */
  export type Workout$setsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
    where?: SetLogWhereInput
    orderBy?: SetLogOrderByWithRelationInput | SetLogOrderByWithRelationInput[]
    cursor?: SetLogWhereUniqueInput
    take?: number
    skip?: number
    distinct?: SetLogScalarFieldEnum | SetLogScalarFieldEnum[]
  }

  /**
   * Workout without action
   */
  export type WorkoutDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Workout
     */
    select?: WorkoutSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Workout
     */
    omit?: WorkoutOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: WorkoutInclude<ExtArgs> | null
  }


  /**
   * Model SetLog
   */

  export type AggregateSetLog = {
    _count: SetLogCountAggregateOutputType | null
    _avg: SetLogAvgAggregateOutputType | null
    _sum: SetLogSumAggregateOutputType | null
    _min: SetLogMinAggregateOutputType | null
    _max: SetLogMaxAggregateOutputType | null
  }

  export type SetLogAvgAggregateOutputType = {
    setIndex: number | null
    kg: number | null
    reps: number | null
  }

  export type SetLogSumAggregateOutputType = {
    setIndex: number | null
    kg: number | null
    reps: number | null
  }

  export type SetLogMinAggregateOutputType = {
    id: string | null
    workoutId: string | null
    exercise: string | null
    setIndex: number | null
    kg: number | null
    reps: number | null
    loggedAt: Date | null
  }

  export type SetLogMaxAggregateOutputType = {
    id: string | null
    workoutId: string | null
    exercise: string | null
    setIndex: number | null
    kg: number | null
    reps: number | null
    loggedAt: Date | null
  }

  export type SetLogCountAggregateOutputType = {
    id: number
    workoutId: number
    exercise: number
    setIndex: number
    kg: number
    reps: number
    loggedAt: number
    _all: number
  }


  export type SetLogAvgAggregateInputType = {
    setIndex?: true
    kg?: true
    reps?: true
  }

  export type SetLogSumAggregateInputType = {
    setIndex?: true
    kg?: true
    reps?: true
  }

  export type SetLogMinAggregateInputType = {
    id?: true
    workoutId?: true
    exercise?: true
    setIndex?: true
    kg?: true
    reps?: true
    loggedAt?: true
  }

  export type SetLogMaxAggregateInputType = {
    id?: true
    workoutId?: true
    exercise?: true
    setIndex?: true
    kg?: true
    reps?: true
    loggedAt?: true
  }

  export type SetLogCountAggregateInputType = {
    id?: true
    workoutId?: true
    exercise?: true
    setIndex?: true
    kg?: true
    reps?: true
    loggedAt?: true
    _all?: true
  }

  export type SetLogAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SetLog to aggregate.
     */
    where?: SetLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SetLogs to fetch.
     */
    orderBy?: SetLogOrderByWithRelationInput | SetLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SetLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SetLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SetLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SetLogs
    **/
    _count?: true | SetLogCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SetLogAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SetLogSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SetLogMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SetLogMaxAggregateInputType
  }

  export type GetSetLogAggregateType<T extends SetLogAggregateArgs> = {
        [P in keyof T & keyof AggregateSetLog]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSetLog[P]>
      : GetScalarType<T[P], AggregateSetLog[P]>
  }




  export type SetLogGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SetLogWhereInput
    orderBy?: SetLogOrderByWithAggregationInput | SetLogOrderByWithAggregationInput[]
    by: SetLogScalarFieldEnum[] | SetLogScalarFieldEnum
    having?: SetLogScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SetLogCountAggregateInputType | true
    _avg?: SetLogAvgAggregateInputType
    _sum?: SetLogSumAggregateInputType
    _min?: SetLogMinAggregateInputType
    _max?: SetLogMaxAggregateInputType
  }

  export type SetLogGroupByOutputType = {
    id: string
    workoutId: string
    exercise: string
    setIndex: number
    kg: number
    reps: number
    loggedAt: Date
    _count: SetLogCountAggregateOutputType | null
    _avg: SetLogAvgAggregateOutputType | null
    _sum: SetLogSumAggregateOutputType | null
    _min: SetLogMinAggregateOutputType | null
    _max: SetLogMaxAggregateOutputType | null
  }

  type GetSetLogGroupByPayload<T extends SetLogGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SetLogGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SetLogGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SetLogGroupByOutputType[P]>
            : GetScalarType<T[P], SetLogGroupByOutputType[P]>
        }
      >
    >


  export type SetLogSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    workoutId?: boolean
    exercise?: boolean
    setIndex?: boolean
    kg?: boolean
    reps?: boolean
    loggedAt?: boolean
    workout?: boolean | WorkoutDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["setLog"]>

  export type SetLogSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    workoutId?: boolean
    exercise?: boolean
    setIndex?: boolean
    kg?: boolean
    reps?: boolean
    loggedAt?: boolean
    workout?: boolean | WorkoutDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["setLog"]>

  export type SetLogSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    workoutId?: boolean
    exercise?: boolean
    setIndex?: boolean
    kg?: boolean
    reps?: boolean
    loggedAt?: boolean
    workout?: boolean | WorkoutDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["setLog"]>

  export type SetLogSelectScalar = {
    id?: boolean
    workoutId?: boolean
    exercise?: boolean
    setIndex?: boolean
    kg?: boolean
    reps?: boolean
    loggedAt?: boolean
  }

  export type SetLogOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "workoutId" | "exercise" | "setIndex" | "kg" | "reps" | "loggedAt", ExtArgs["result"]["setLog"]>
  export type SetLogInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workout?: boolean | WorkoutDefaultArgs<ExtArgs>
  }
  export type SetLogIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workout?: boolean | WorkoutDefaultArgs<ExtArgs>
  }
  export type SetLogIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    workout?: boolean | WorkoutDefaultArgs<ExtArgs>
  }

  export type $SetLogPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SetLog"
    objects: {
      workout: Prisma.$WorkoutPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      workoutId: string
      /**
       * Übungsname als Text statt Fremdschlüssel: Übungen wechseln (Gerät belegt,
       * Schulter zwickt), und ein starrer Katalog würde das nur behindern.
       */
      exercise: string
      setIndex: number
      kg: number
      reps: number
      loggedAt: Date
    }, ExtArgs["result"]["setLog"]>
    composites: {}
  }

  type SetLogGetPayload<S extends boolean | null | undefined | SetLogDefaultArgs> = $Result.GetResult<Prisma.$SetLogPayload, S>

  type SetLogCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SetLogFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SetLogCountAggregateInputType | true
    }

  export interface SetLogDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SetLog'], meta: { name: 'SetLog' } }
    /**
     * Find zero or one SetLog that matches the filter.
     * @param {SetLogFindUniqueArgs} args - Arguments to find a SetLog
     * @example
     * // Get one SetLog
     * const setLog = await prisma.setLog.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SetLogFindUniqueArgs>(args: SelectSubset<T, SetLogFindUniqueArgs<ExtArgs>>): Prisma__SetLogClient<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SetLog that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SetLogFindUniqueOrThrowArgs} args - Arguments to find a SetLog
     * @example
     * // Get one SetLog
     * const setLog = await prisma.setLog.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SetLogFindUniqueOrThrowArgs>(args: SelectSubset<T, SetLogFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SetLogClient<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SetLog that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SetLogFindFirstArgs} args - Arguments to find a SetLog
     * @example
     * // Get one SetLog
     * const setLog = await prisma.setLog.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SetLogFindFirstArgs>(args?: SelectSubset<T, SetLogFindFirstArgs<ExtArgs>>): Prisma__SetLogClient<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SetLog that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SetLogFindFirstOrThrowArgs} args - Arguments to find a SetLog
     * @example
     * // Get one SetLog
     * const setLog = await prisma.setLog.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SetLogFindFirstOrThrowArgs>(args?: SelectSubset<T, SetLogFindFirstOrThrowArgs<ExtArgs>>): Prisma__SetLogClient<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SetLogs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SetLogFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SetLogs
     * const setLogs = await prisma.setLog.findMany()
     * 
     * // Get first 10 SetLogs
     * const setLogs = await prisma.setLog.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const setLogWithIdOnly = await prisma.setLog.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SetLogFindManyArgs>(args?: SelectSubset<T, SetLogFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SetLog.
     * @param {SetLogCreateArgs} args - Arguments to create a SetLog.
     * @example
     * // Create one SetLog
     * const SetLog = await prisma.setLog.create({
     *   data: {
     *     // ... data to create a SetLog
     *   }
     * })
     * 
     */
    create<T extends SetLogCreateArgs>(args: SelectSubset<T, SetLogCreateArgs<ExtArgs>>): Prisma__SetLogClient<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SetLogs.
     * @param {SetLogCreateManyArgs} args - Arguments to create many SetLogs.
     * @example
     * // Create many SetLogs
     * const setLog = await prisma.setLog.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SetLogCreateManyArgs>(args?: SelectSubset<T, SetLogCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SetLogs and returns the data saved in the database.
     * @param {SetLogCreateManyAndReturnArgs} args - Arguments to create many SetLogs.
     * @example
     * // Create many SetLogs
     * const setLog = await prisma.setLog.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SetLogs and only return the `id`
     * const setLogWithIdOnly = await prisma.setLog.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SetLogCreateManyAndReturnArgs>(args?: SelectSubset<T, SetLogCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a SetLog.
     * @param {SetLogDeleteArgs} args - Arguments to delete one SetLog.
     * @example
     * // Delete one SetLog
     * const SetLog = await prisma.setLog.delete({
     *   where: {
     *     // ... filter to delete one SetLog
     *   }
     * })
     * 
     */
    delete<T extends SetLogDeleteArgs>(args: SelectSubset<T, SetLogDeleteArgs<ExtArgs>>): Prisma__SetLogClient<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SetLog.
     * @param {SetLogUpdateArgs} args - Arguments to update one SetLog.
     * @example
     * // Update one SetLog
     * const setLog = await prisma.setLog.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SetLogUpdateArgs>(args: SelectSubset<T, SetLogUpdateArgs<ExtArgs>>): Prisma__SetLogClient<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SetLogs.
     * @param {SetLogDeleteManyArgs} args - Arguments to filter SetLogs to delete.
     * @example
     * // Delete a few SetLogs
     * const { count } = await prisma.setLog.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SetLogDeleteManyArgs>(args?: SelectSubset<T, SetLogDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SetLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SetLogUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SetLogs
     * const setLog = await prisma.setLog.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SetLogUpdateManyArgs>(args: SelectSubset<T, SetLogUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SetLogs and returns the data updated in the database.
     * @param {SetLogUpdateManyAndReturnArgs} args - Arguments to update many SetLogs.
     * @example
     * // Update many SetLogs
     * const setLog = await prisma.setLog.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more SetLogs and only return the `id`
     * const setLogWithIdOnly = await prisma.setLog.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SetLogUpdateManyAndReturnArgs>(args: SelectSubset<T, SetLogUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one SetLog.
     * @param {SetLogUpsertArgs} args - Arguments to update or create a SetLog.
     * @example
     * // Update or create a SetLog
     * const setLog = await prisma.setLog.upsert({
     *   create: {
     *     // ... data to create a SetLog
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SetLog we want to update
     *   }
     * })
     */
    upsert<T extends SetLogUpsertArgs>(args: SelectSubset<T, SetLogUpsertArgs<ExtArgs>>): Prisma__SetLogClient<$Result.GetResult<Prisma.$SetLogPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SetLogs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SetLogCountArgs} args - Arguments to filter SetLogs to count.
     * @example
     * // Count the number of SetLogs
     * const count = await prisma.setLog.count({
     *   where: {
     *     // ... the filter for the SetLogs we want to count
     *   }
     * })
    **/
    count<T extends SetLogCountArgs>(
      args?: Subset<T, SetLogCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SetLogCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SetLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SetLogAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SetLogAggregateArgs>(args: Subset<T, SetLogAggregateArgs>): Prisma.PrismaPromise<GetSetLogAggregateType<T>>

    /**
     * Group by SetLog.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SetLogGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SetLogGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SetLogGroupByArgs['orderBy'] }
        : { orderBy?: SetLogGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SetLogGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSetLogGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SetLog model
   */
  readonly fields: SetLogFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SetLog.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SetLogClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    workout<T extends WorkoutDefaultArgs<ExtArgs> = {}>(args?: Subset<T, WorkoutDefaultArgs<ExtArgs>>): Prisma__WorkoutClient<$Result.GetResult<Prisma.$WorkoutPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SetLog model
   */
  interface SetLogFieldRefs {
    readonly id: FieldRef<"SetLog", 'String'>
    readonly workoutId: FieldRef<"SetLog", 'String'>
    readonly exercise: FieldRef<"SetLog", 'String'>
    readonly setIndex: FieldRef<"SetLog", 'Int'>
    readonly kg: FieldRef<"SetLog", 'Float'>
    readonly reps: FieldRef<"SetLog", 'Int'>
    readonly loggedAt: FieldRef<"SetLog", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * SetLog findUnique
   */
  export type SetLogFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
    /**
     * Filter, which SetLog to fetch.
     */
    where: SetLogWhereUniqueInput
  }

  /**
   * SetLog findUniqueOrThrow
   */
  export type SetLogFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
    /**
     * Filter, which SetLog to fetch.
     */
    where: SetLogWhereUniqueInput
  }

  /**
   * SetLog findFirst
   */
  export type SetLogFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
    /**
     * Filter, which SetLog to fetch.
     */
    where?: SetLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SetLogs to fetch.
     */
    orderBy?: SetLogOrderByWithRelationInput | SetLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SetLogs.
     */
    cursor?: SetLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SetLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SetLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SetLogs.
     */
    distinct?: SetLogScalarFieldEnum | SetLogScalarFieldEnum[]
  }

  /**
   * SetLog findFirstOrThrow
   */
  export type SetLogFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
    /**
     * Filter, which SetLog to fetch.
     */
    where?: SetLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SetLogs to fetch.
     */
    orderBy?: SetLogOrderByWithRelationInput | SetLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SetLogs.
     */
    cursor?: SetLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SetLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SetLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SetLogs.
     */
    distinct?: SetLogScalarFieldEnum | SetLogScalarFieldEnum[]
  }

  /**
   * SetLog findMany
   */
  export type SetLogFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
    /**
     * Filter, which SetLogs to fetch.
     */
    where?: SetLogWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SetLogs to fetch.
     */
    orderBy?: SetLogOrderByWithRelationInput | SetLogOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SetLogs.
     */
    cursor?: SetLogWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SetLogs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SetLogs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SetLogs.
     */
    distinct?: SetLogScalarFieldEnum | SetLogScalarFieldEnum[]
  }

  /**
   * SetLog create
   */
  export type SetLogCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
    /**
     * The data needed to create a SetLog.
     */
    data: XOR<SetLogCreateInput, SetLogUncheckedCreateInput>
  }

  /**
   * SetLog createMany
   */
  export type SetLogCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SetLogs.
     */
    data: SetLogCreateManyInput | SetLogCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SetLog createManyAndReturn
   */
  export type SetLogCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * The data used to create many SetLogs.
     */
    data: SetLogCreateManyInput | SetLogCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * SetLog update
   */
  export type SetLogUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
    /**
     * The data needed to update a SetLog.
     */
    data: XOR<SetLogUpdateInput, SetLogUncheckedUpdateInput>
    /**
     * Choose, which SetLog to update.
     */
    where: SetLogWhereUniqueInput
  }

  /**
   * SetLog updateMany
   */
  export type SetLogUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SetLogs.
     */
    data: XOR<SetLogUpdateManyMutationInput, SetLogUncheckedUpdateManyInput>
    /**
     * Filter which SetLogs to update
     */
    where?: SetLogWhereInput
    /**
     * Limit how many SetLogs to update.
     */
    limit?: number
  }

  /**
   * SetLog updateManyAndReturn
   */
  export type SetLogUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * The data used to update SetLogs.
     */
    data: XOR<SetLogUpdateManyMutationInput, SetLogUncheckedUpdateManyInput>
    /**
     * Filter which SetLogs to update
     */
    where?: SetLogWhereInput
    /**
     * Limit how many SetLogs to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * SetLog upsert
   */
  export type SetLogUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
    /**
     * The filter to search for the SetLog to update in case it exists.
     */
    where: SetLogWhereUniqueInput
    /**
     * In case the SetLog found by the `where` argument doesn't exist, create a new SetLog with this data.
     */
    create: XOR<SetLogCreateInput, SetLogUncheckedCreateInput>
    /**
     * In case the SetLog was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SetLogUpdateInput, SetLogUncheckedUpdateInput>
  }

  /**
   * SetLog delete
   */
  export type SetLogDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
    /**
     * Filter which SetLog to delete.
     */
    where: SetLogWhereUniqueInput
  }

  /**
   * SetLog deleteMany
   */
  export type SetLogDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SetLogs to delete
     */
    where?: SetLogWhereInput
    /**
     * Limit how many SetLogs to delete.
     */
    limit?: number
  }

  /**
   * SetLog without action
   */
  export type SetLogDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SetLog
     */
    select?: SetLogSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SetLog
     */
    omit?: SetLogOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SetLogInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const EinstellungScalarFieldEnum: {
    schluessel: 'schluessel',
    wert: 'wert',
    aktualisiert: 'aktualisiert'
  };

  export type EinstellungScalarFieldEnum = (typeof EinstellungScalarFieldEnum)[keyof typeof EinstellungScalarFieldEnum]


  export const WorkoutScalarFieldEnum: {
    id: 'id',
    date: 'date',
    kind: 'kind',
    startedAt: 'startedAt',
    finishedAt: 'finishedAt',
    note: 'note'
  };

  export type WorkoutScalarFieldEnum = (typeof WorkoutScalarFieldEnum)[keyof typeof WorkoutScalarFieldEnum]


  export const SetLogScalarFieldEnum: {
    id: 'id',
    workoutId: 'workoutId',
    exercise: 'exercise',
    setIndex: 'setIndex',
    kg: 'kg',
    reps: 'reps',
    loggedAt: 'loggedAt'
  };

  export type SetLogScalarFieldEnum = (typeof SetLogScalarFieldEnum)[keyof typeof SetLogScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    
  /**
   * Deep Input Types
   */


  export type EinstellungWhereInput = {
    AND?: EinstellungWhereInput | EinstellungWhereInput[]
    OR?: EinstellungWhereInput[]
    NOT?: EinstellungWhereInput | EinstellungWhereInput[]
    schluessel?: StringFilter<"Einstellung"> | string
    wert?: StringFilter<"Einstellung"> | string
    aktualisiert?: DateTimeFilter<"Einstellung"> | Date | string
  }

  export type EinstellungOrderByWithRelationInput = {
    schluessel?: SortOrder
    wert?: SortOrder
    aktualisiert?: SortOrder
  }

  export type EinstellungWhereUniqueInput = Prisma.AtLeast<{
    schluessel?: string
    AND?: EinstellungWhereInput | EinstellungWhereInput[]
    OR?: EinstellungWhereInput[]
    NOT?: EinstellungWhereInput | EinstellungWhereInput[]
    wert?: StringFilter<"Einstellung"> | string
    aktualisiert?: DateTimeFilter<"Einstellung"> | Date | string
  }, "schluessel">

  export type EinstellungOrderByWithAggregationInput = {
    schluessel?: SortOrder
    wert?: SortOrder
    aktualisiert?: SortOrder
    _count?: EinstellungCountOrderByAggregateInput
    _max?: EinstellungMaxOrderByAggregateInput
    _min?: EinstellungMinOrderByAggregateInput
  }

  export type EinstellungScalarWhereWithAggregatesInput = {
    AND?: EinstellungScalarWhereWithAggregatesInput | EinstellungScalarWhereWithAggregatesInput[]
    OR?: EinstellungScalarWhereWithAggregatesInput[]
    NOT?: EinstellungScalarWhereWithAggregatesInput | EinstellungScalarWhereWithAggregatesInput[]
    schluessel?: StringWithAggregatesFilter<"Einstellung"> | string
    wert?: StringWithAggregatesFilter<"Einstellung"> | string
    aktualisiert?: DateTimeWithAggregatesFilter<"Einstellung"> | Date | string
  }

  export type WorkoutWhereInput = {
    AND?: WorkoutWhereInput | WorkoutWhereInput[]
    OR?: WorkoutWhereInput[]
    NOT?: WorkoutWhereInput | WorkoutWhereInput[]
    id?: StringFilter<"Workout"> | string
    date?: DateTimeFilter<"Workout"> | Date | string
    kind?: StringFilter<"Workout"> | string
    startedAt?: DateTimeFilter<"Workout"> | Date | string
    finishedAt?: DateTimeNullableFilter<"Workout"> | Date | string | null
    note?: StringNullableFilter<"Workout"> | string | null
    sets?: SetLogListRelationFilter
  }

  export type WorkoutOrderByWithRelationInput = {
    id?: SortOrder
    date?: SortOrder
    kind?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrderInput | SortOrder
    note?: SortOrderInput | SortOrder
    sets?: SetLogOrderByRelationAggregateInput
  }

  export type WorkoutWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: WorkoutWhereInput | WorkoutWhereInput[]
    OR?: WorkoutWhereInput[]
    NOT?: WorkoutWhereInput | WorkoutWhereInput[]
    date?: DateTimeFilter<"Workout"> | Date | string
    kind?: StringFilter<"Workout"> | string
    startedAt?: DateTimeFilter<"Workout"> | Date | string
    finishedAt?: DateTimeNullableFilter<"Workout"> | Date | string | null
    note?: StringNullableFilter<"Workout"> | string | null
    sets?: SetLogListRelationFilter
  }, "id">

  export type WorkoutOrderByWithAggregationInput = {
    id?: SortOrder
    date?: SortOrder
    kind?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrderInput | SortOrder
    note?: SortOrderInput | SortOrder
    _count?: WorkoutCountOrderByAggregateInput
    _max?: WorkoutMaxOrderByAggregateInput
    _min?: WorkoutMinOrderByAggregateInput
  }

  export type WorkoutScalarWhereWithAggregatesInput = {
    AND?: WorkoutScalarWhereWithAggregatesInput | WorkoutScalarWhereWithAggregatesInput[]
    OR?: WorkoutScalarWhereWithAggregatesInput[]
    NOT?: WorkoutScalarWhereWithAggregatesInput | WorkoutScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Workout"> | string
    date?: DateTimeWithAggregatesFilter<"Workout"> | Date | string
    kind?: StringWithAggregatesFilter<"Workout"> | string
    startedAt?: DateTimeWithAggregatesFilter<"Workout"> | Date | string
    finishedAt?: DateTimeNullableWithAggregatesFilter<"Workout"> | Date | string | null
    note?: StringNullableWithAggregatesFilter<"Workout"> | string | null
  }

  export type SetLogWhereInput = {
    AND?: SetLogWhereInput | SetLogWhereInput[]
    OR?: SetLogWhereInput[]
    NOT?: SetLogWhereInput | SetLogWhereInput[]
    id?: StringFilter<"SetLog"> | string
    workoutId?: StringFilter<"SetLog"> | string
    exercise?: StringFilter<"SetLog"> | string
    setIndex?: IntFilter<"SetLog"> | number
    kg?: FloatFilter<"SetLog"> | number
    reps?: IntFilter<"SetLog"> | number
    loggedAt?: DateTimeFilter<"SetLog"> | Date | string
    workout?: XOR<WorkoutScalarRelationFilter, WorkoutWhereInput>
  }

  export type SetLogOrderByWithRelationInput = {
    id?: SortOrder
    workoutId?: SortOrder
    exercise?: SortOrder
    setIndex?: SortOrder
    kg?: SortOrder
    reps?: SortOrder
    loggedAt?: SortOrder
    workout?: WorkoutOrderByWithRelationInput
  }

  export type SetLogWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    workoutId_exercise_setIndex?: SetLogWorkoutIdExerciseSetIndexCompoundUniqueInput
    AND?: SetLogWhereInput | SetLogWhereInput[]
    OR?: SetLogWhereInput[]
    NOT?: SetLogWhereInput | SetLogWhereInput[]
    workoutId?: StringFilter<"SetLog"> | string
    exercise?: StringFilter<"SetLog"> | string
    setIndex?: IntFilter<"SetLog"> | number
    kg?: FloatFilter<"SetLog"> | number
    reps?: IntFilter<"SetLog"> | number
    loggedAt?: DateTimeFilter<"SetLog"> | Date | string
    workout?: XOR<WorkoutScalarRelationFilter, WorkoutWhereInput>
  }, "id" | "workoutId_exercise_setIndex">

  export type SetLogOrderByWithAggregationInput = {
    id?: SortOrder
    workoutId?: SortOrder
    exercise?: SortOrder
    setIndex?: SortOrder
    kg?: SortOrder
    reps?: SortOrder
    loggedAt?: SortOrder
    _count?: SetLogCountOrderByAggregateInput
    _avg?: SetLogAvgOrderByAggregateInput
    _max?: SetLogMaxOrderByAggregateInput
    _min?: SetLogMinOrderByAggregateInput
    _sum?: SetLogSumOrderByAggregateInput
  }

  export type SetLogScalarWhereWithAggregatesInput = {
    AND?: SetLogScalarWhereWithAggregatesInput | SetLogScalarWhereWithAggregatesInput[]
    OR?: SetLogScalarWhereWithAggregatesInput[]
    NOT?: SetLogScalarWhereWithAggregatesInput | SetLogScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"SetLog"> | string
    workoutId?: StringWithAggregatesFilter<"SetLog"> | string
    exercise?: StringWithAggregatesFilter<"SetLog"> | string
    setIndex?: IntWithAggregatesFilter<"SetLog"> | number
    kg?: FloatWithAggregatesFilter<"SetLog"> | number
    reps?: IntWithAggregatesFilter<"SetLog"> | number
    loggedAt?: DateTimeWithAggregatesFilter<"SetLog"> | Date | string
  }

  export type EinstellungCreateInput = {
    schluessel: string
    wert: string
    aktualisiert?: Date | string
  }

  export type EinstellungUncheckedCreateInput = {
    schluessel: string
    wert: string
    aktualisiert?: Date | string
  }

  export type EinstellungUpdateInput = {
    schluessel?: StringFieldUpdateOperationsInput | string
    wert?: StringFieldUpdateOperationsInput | string
    aktualisiert?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EinstellungUncheckedUpdateInput = {
    schluessel?: StringFieldUpdateOperationsInput | string
    wert?: StringFieldUpdateOperationsInput | string
    aktualisiert?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EinstellungCreateManyInput = {
    schluessel: string
    wert: string
    aktualisiert?: Date | string
  }

  export type EinstellungUpdateManyMutationInput = {
    schluessel?: StringFieldUpdateOperationsInput | string
    wert?: StringFieldUpdateOperationsInput | string
    aktualisiert?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type EinstellungUncheckedUpdateManyInput = {
    schluessel?: StringFieldUpdateOperationsInput | string
    wert?: StringFieldUpdateOperationsInput | string
    aktualisiert?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type WorkoutCreateInput = {
    id?: string
    date: Date | string
    kind: string
    startedAt?: Date | string
    finishedAt?: Date | string | null
    note?: string | null
    sets?: SetLogCreateNestedManyWithoutWorkoutInput
  }

  export type WorkoutUncheckedCreateInput = {
    id?: string
    date: Date | string
    kind: string
    startedAt?: Date | string
    finishedAt?: Date | string | null
    note?: string | null
    sets?: SetLogUncheckedCreateNestedManyWithoutWorkoutInput
  }

  export type WorkoutUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    kind?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    note?: NullableStringFieldUpdateOperationsInput | string | null
    sets?: SetLogUpdateManyWithoutWorkoutNestedInput
  }

  export type WorkoutUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    kind?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    note?: NullableStringFieldUpdateOperationsInput | string | null
    sets?: SetLogUncheckedUpdateManyWithoutWorkoutNestedInput
  }

  export type WorkoutCreateManyInput = {
    id?: string
    date: Date | string
    kind: string
    startedAt?: Date | string
    finishedAt?: Date | string | null
    note?: string | null
  }

  export type WorkoutUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    kind?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    note?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type WorkoutUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    kind?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    note?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type SetLogCreateInput = {
    id?: string
    exercise: string
    setIndex: number
    kg: number
    reps: number
    loggedAt?: Date | string
    workout: WorkoutCreateNestedOneWithoutSetsInput
  }

  export type SetLogUncheckedCreateInput = {
    id?: string
    workoutId: string
    exercise: string
    setIndex: number
    kg: number
    reps: number
    loggedAt?: Date | string
  }

  export type SetLogUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    exercise?: StringFieldUpdateOperationsInput | string
    setIndex?: IntFieldUpdateOperationsInput | number
    kg?: FloatFieldUpdateOperationsInput | number
    reps?: IntFieldUpdateOperationsInput | number
    loggedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    workout?: WorkoutUpdateOneRequiredWithoutSetsNestedInput
  }

  export type SetLogUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    workoutId?: StringFieldUpdateOperationsInput | string
    exercise?: StringFieldUpdateOperationsInput | string
    setIndex?: IntFieldUpdateOperationsInput | number
    kg?: FloatFieldUpdateOperationsInput | number
    reps?: IntFieldUpdateOperationsInput | number
    loggedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SetLogCreateManyInput = {
    id?: string
    workoutId: string
    exercise: string
    setIndex: number
    kg: number
    reps: number
    loggedAt?: Date | string
  }

  export type SetLogUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    exercise?: StringFieldUpdateOperationsInput | string
    setIndex?: IntFieldUpdateOperationsInput | number
    kg?: FloatFieldUpdateOperationsInput | number
    reps?: IntFieldUpdateOperationsInput | number
    loggedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SetLogUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    workoutId?: StringFieldUpdateOperationsInput | string
    exercise?: StringFieldUpdateOperationsInput | string
    setIndex?: IntFieldUpdateOperationsInput | number
    kg?: FloatFieldUpdateOperationsInput | number
    reps?: IntFieldUpdateOperationsInput | number
    loggedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type EinstellungCountOrderByAggregateInput = {
    schluessel?: SortOrder
    wert?: SortOrder
    aktualisiert?: SortOrder
  }

  export type EinstellungMaxOrderByAggregateInput = {
    schluessel?: SortOrder
    wert?: SortOrder
    aktualisiert?: SortOrder
  }

  export type EinstellungMinOrderByAggregateInput = {
    schluessel?: SortOrder
    wert?: SortOrder
    aktualisiert?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type SetLogListRelationFilter = {
    every?: SetLogWhereInput
    some?: SetLogWhereInput
    none?: SetLogWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type SetLogOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type WorkoutCountOrderByAggregateInput = {
    id?: SortOrder
    date?: SortOrder
    kind?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    note?: SortOrder
  }

  export type WorkoutMaxOrderByAggregateInput = {
    id?: SortOrder
    date?: SortOrder
    kind?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    note?: SortOrder
  }

  export type WorkoutMinOrderByAggregateInput = {
    id?: SortOrder
    date?: SortOrder
    kind?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    note?: SortOrder
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type WorkoutScalarRelationFilter = {
    is?: WorkoutWhereInput
    isNot?: WorkoutWhereInput
  }

  export type SetLogWorkoutIdExerciseSetIndexCompoundUniqueInput = {
    workoutId: string
    exercise: string
    setIndex: number
  }

  export type SetLogCountOrderByAggregateInput = {
    id?: SortOrder
    workoutId?: SortOrder
    exercise?: SortOrder
    setIndex?: SortOrder
    kg?: SortOrder
    reps?: SortOrder
    loggedAt?: SortOrder
  }

  export type SetLogAvgOrderByAggregateInput = {
    setIndex?: SortOrder
    kg?: SortOrder
    reps?: SortOrder
  }

  export type SetLogMaxOrderByAggregateInput = {
    id?: SortOrder
    workoutId?: SortOrder
    exercise?: SortOrder
    setIndex?: SortOrder
    kg?: SortOrder
    reps?: SortOrder
    loggedAt?: SortOrder
  }

  export type SetLogMinOrderByAggregateInput = {
    id?: SortOrder
    workoutId?: SortOrder
    exercise?: SortOrder
    setIndex?: SortOrder
    kg?: SortOrder
    reps?: SortOrder
    loggedAt?: SortOrder
  }

  export type SetLogSumOrderByAggregateInput = {
    setIndex?: SortOrder
    kg?: SortOrder
    reps?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type SetLogCreateNestedManyWithoutWorkoutInput = {
    create?: XOR<SetLogCreateWithoutWorkoutInput, SetLogUncheckedCreateWithoutWorkoutInput> | SetLogCreateWithoutWorkoutInput[] | SetLogUncheckedCreateWithoutWorkoutInput[]
    connectOrCreate?: SetLogCreateOrConnectWithoutWorkoutInput | SetLogCreateOrConnectWithoutWorkoutInput[]
    createMany?: SetLogCreateManyWorkoutInputEnvelope
    connect?: SetLogWhereUniqueInput | SetLogWhereUniqueInput[]
  }

  export type SetLogUncheckedCreateNestedManyWithoutWorkoutInput = {
    create?: XOR<SetLogCreateWithoutWorkoutInput, SetLogUncheckedCreateWithoutWorkoutInput> | SetLogCreateWithoutWorkoutInput[] | SetLogUncheckedCreateWithoutWorkoutInput[]
    connectOrCreate?: SetLogCreateOrConnectWithoutWorkoutInput | SetLogCreateOrConnectWithoutWorkoutInput[]
    createMany?: SetLogCreateManyWorkoutInputEnvelope
    connect?: SetLogWhereUniqueInput | SetLogWhereUniqueInput[]
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type SetLogUpdateManyWithoutWorkoutNestedInput = {
    create?: XOR<SetLogCreateWithoutWorkoutInput, SetLogUncheckedCreateWithoutWorkoutInput> | SetLogCreateWithoutWorkoutInput[] | SetLogUncheckedCreateWithoutWorkoutInput[]
    connectOrCreate?: SetLogCreateOrConnectWithoutWorkoutInput | SetLogCreateOrConnectWithoutWorkoutInput[]
    upsert?: SetLogUpsertWithWhereUniqueWithoutWorkoutInput | SetLogUpsertWithWhereUniqueWithoutWorkoutInput[]
    createMany?: SetLogCreateManyWorkoutInputEnvelope
    set?: SetLogWhereUniqueInput | SetLogWhereUniqueInput[]
    disconnect?: SetLogWhereUniqueInput | SetLogWhereUniqueInput[]
    delete?: SetLogWhereUniqueInput | SetLogWhereUniqueInput[]
    connect?: SetLogWhereUniqueInput | SetLogWhereUniqueInput[]
    update?: SetLogUpdateWithWhereUniqueWithoutWorkoutInput | SetLogUpdateWithWhereUniqueWithoutWorkoutInput[]
    updateMany?: SetLogUpdateManyWithWhereWithoutWorkoutInput | SetLogUpdateManyWithWhereWithoutWorkoutInput[]
    deleteMany?: SetLogScalarWhereInput | SetLogScalarWhereInput[]
  }

  export type SetLogUncheckedUpdateManyWithoutWorkoutNestedInput = {
    create?: XOR<SetLogCreateWithoutWorkoutInput, SetLogUncheckedCreateWithoutWorkoutInput> | SetLogCreateWithoutWorkoutInput[] | SetLogUncheckedCreateWithoutWorkoutInput[]
    connectOrCreate?: SetLogCreateOrConnectWithoutWorkoutInput | SetLogCreateOrConnectWithoutWorkoutInput[]
    upsert?: SetLogUpsertWithWhereUniqueWithoutWorkoutInput | SetLogUpsertWithWhereUniqueWithoutWorkoutInput[]
    createMany?: SetLogCreateManyWorkoutInputEnvelope
    set?: SetLogWhereUniqueInput | SetLogWhereUniqueInput[]
    disconnect?: SetLogWhereUniqueInput | SetLogWhereUniqueInput[]
    delete?: SetLogWhereUniqueInput | SetLogWhereUniqueInput[]
    connect?: SetLogWhereUniqueInput | SetLogWhereUniqueInput[]
    update?: SetLogUpdateWithWhereUniqueWithoutWorkoutInput | SetLogUpdateWithWhereUniqueWithoutWorkoutInput[]
    updateMany?: SetLogUpdateManyWithWhereWithoutWorkoutInput | SetLogUpdateManyWithWhereWithoutWorkoutInput[]
    deleteMany?: SetLogScalarWhereInput | SetLogScalarWhereInput[]
  }

  export type WorkoutCreateNestedOneWithoutSetsInput = {
    create?: XOR<WorkoutCreateWithoutSetsInput, WorkoutUncheckedCreateWithoutSetsInput>
    connectOrCreate?: WorkoutCreateOrConnectWithoutSetsInput
    connect?: WorkoutWhereUniqueInput
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type WorkoutUpdateOneRequiredWithoutSetsNestedInput = {
    create?: XOR<WorkoutCreateWithoutSetsInput, WorkoutUncheckedCreateWithoutSetsInput>
    connectOrCreate?: WorkoutCreateOrConnectWithoutSetsInput
    upsert?: WorkoutUpsertWithoutSetsInput
    connect?: WorkoutWhereUniqueInput
    update?: XOR<XOR<WorkoutUpdateToOneWithWhereWithoutSetsInput, WorkoutUpdateWithoutSetsInput>, WorkoutUncheckedUpdateWithoutSetsInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type SetLogCreateWithoutWorkoutInput = {
    id?: string
    exercise: string
    setIndex: number
    kg: number
    reps: number
    loggedAt?: Date | string
  }

  export type SetLogUncheckedCreateWithoutWorkoutInput = {
    id?: string
    exercise: string
    setIndex: number
    kg: number
    reps: number
    loggedAt?: Date | string
  }

  export type SetLogCreateOrConnectWithoutWorkoutInput = {
    where: SetLogWhereUniqueInput
    create: XOR<SetLogCreateWithoutWorkoutInput, SetLogUncheckedCreateWithoutWorkoutInput>
  }

  export type SetLogCreateManyWorkoutInputEnvelope = {
    data: SetLogCreateManyWorkoutInput | SetLogCreateManyWorkoutInput[]
    skipDuplicates?: boolean
  }

  export type SetLogUpsertWithWhereUniqueWithoutWorkoutInput = {
    where: SetLogWhereUniqueInput
    update: XOR<SetLogUpdateWithoutWorkoutInput, SetLogUncheckedUpdateWithoutWorkoutInput>
    create: XOR<SetLogCreateWithoutWorkoutInput, SetLogUncheckedCreateWithoutWorkoutInput>
  }

  export type SetLogUpdateWithWhereUniqueWithoutWorkoutInput = {
    where: SetLogWhereUniqueInput
    data: XOR<SetLogUpdateWithoutWorkoutInput, SetLogUncheckedUpdateWithoutWorkoutInput>
  }

  export type SetLogUpdateManyWithWhereWithoutWorkoutInput = {
    where: SetLogScalarWhereInput
    data: XOR<SetLogUpdateManyMutationInput, SetLogUncheckedUpdateManyWithoutWorkoutInput>
  }

  export type SetLogScalarWhereInput = {
    AND?: SetLogScalarWhereInput | SetLogScalarWhereInput[]
    OR?: SetLogScalarWhereInput[]
    NOT?: SetLogScalarWhereInput | SetLogScalarWhereInput[]
    id?: StringFilter<"SetLog"> | string
    workoutId?: StringFilter<"SetLog"> | string
    exercise?: StringFilter<"SetLog"> | string
    setIndex?: IntFilter<"SetLog"> | number
    kg?: FloatFilter<"SetLog"> | number
    reps?: IntFilter<"SetLog"> | number
    loggedAt?: DateTimeFilter<"SetLog"> | Date | string
  }

  export type WorkoutCreateWithoutSetsInput = {
    id?: string
    date: Date | string
    kind: string
    startedAt?: Date | string
    finishedAt?: Date | string | null
    note?: string | null
  }

  export type WorkoutUncheckedCreateWithoutSetsInput = {
    id?: string
    date: Date | string
    kind: string
    startedAt?: Date | string
    finishedAt?: Date | string | null
    note?: string | null
  }

  export type WorkoutCreateOrConnectWithoutSetsInput = {
    where: WorkoutWhereUniqueInput
    create: XOR<WorkoutCreateWithoutSetsInput, WorkoutUncheckedCreateWithoutSetsInput>
  }

  export type WorkoutUpsertWithoutSetsInput = {
    update: XOR<WorkoutUpdateWithoutSetsInput, WorkoutUncheckedUpdateWithoutSetsInput>
    create: XOR<WorkoutCreateWithoutSetsInput, WorkoutUncheckedCreateWithoutSetsInput>
    where?: WorkoutWhereInput
  }

  export type WorkoutUpdateToOneWithWhereWithoutSetsInput = {
    where?: WorkoutWhereInput
    data: XOR<WorkoutUpdateWithoutSetsInput, WorkoutUncheckedUpdateWithoutSetsInput>
  }

  export type WorkoutUpdateWithoutSetsInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    kind?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    note?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type WorkoutUncheckedUpdateWithoutSetsInput = {
    id?: StringFieldUpdateOperationsInput | string
    date?: DateTimeFieldUpdateOperationsInput | Date | string
    kind?: StringFieldUpdateOperationsInput | string
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    note?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type SetLogCreateManyWorkoutInput = {
    id?: string
    exercise: string
    setIndex: number
    kg: number
    reps: number
    loggedAt?: Date | string
  }

  export type SetLogUpdateWithoutWorkoutInput = {
    id?: StringFieldUpdateOperationsInput | string
    exercise?: StringFieldUpdateOperationsInput | string
    setIndex?: IntFieldUpdateOperationsInput | number
    kg?: FloatFieldUpdateOperationsInput | number
    reps?: IntFieldUpdateOperationsInput | number
    loggedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SetLogUncheckedUpdateWithoutWorkoutInput = {
    id?: StringFieldUpdateOperationsInput | string
    exercise?: StringFieldUpdateOperationsInput | string
    setIndex?: IntFieldUpdateOperationsInput | number
    kg?: FloatFieldUpdateOperationsInput | number
    reps?: IntFieldUpdateOperationsInput | number
    loggedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SetLogUncheckedUpdateManyWithoutWorkoutInput = {
    id?: StringFieldUpdateOperationsInput | string
    exercise?: StringFieldUpdateOperationsInput | string
    setIndex?: IntFieldUpdateOperationsInput | number
    kg?: FloatFieldUpdateOperationsInput | number
    reps?: IntFieldUpdateOperationsInput | number
    loggedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}