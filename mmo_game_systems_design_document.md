# P2P ProSocial 3D MMORPG — Game Systems Design Document

## 1. Purpose

This document defines a concrete systems-design direction for evolving the current voxel multiplayer prototype into a persistent social-material simulation MMORPG.

The intended game is not primarily a recipe-crafting survival sandbox. It is a world where players and NPC societies gather and transform local materials into tools, shelters, institutions, and durable social relationships. Material properties, regional ecologies, assemblies, fellowships, offices, and bonded obligations together generate settlement growth, mobility, belonging, conflict, sovereignty, and gameplay progression.

The design assumes the current prototype remains the technical seed:
- server-authoritative multiplayer
- chunked procedural voxel world
- inventory and container systems
- harvesting, block placement, and world updates

The design below extends that foundation into a simulation of:
- material invention
- improvised and formalized craft
- evolving structures and settlements
- regional specialization and substitution chains
- territorial and non-territorial sovereignty
- oathbonds, offices, quorum, and delegated power
- hospitality, belonging, and protection networks

---

## 2. Design Pillars

### 2.1 Material-first, not recipe-first
Crafting is based on material properties, shaping operations, assembly methods, and discovered patterns rather than giant static recipe tables.

### 2.2 Many valid solutions
Different regions should solve similar problems differently because available resources, climates, risks, and traditions differ.

### 2.3 Structures are built and improved over time
Shelters, compounds, workshops, roads, kilns, walls, and civic structures are assemblies with upkeep, quality, and stewardship rather than single-placeables with fixed stats.

### 2.4 Society is mechanical, not decorative
Bonds, offices, quorum, hospitality, fellowships, and sovereignty change what players can do, where they are protected, and how NPCs respond.

### 2.5 Settled and nomadic peoples are equally real
Legitimacy, belonging, and protection can arise from fixed territory, route networks, seasonal camps, kin webs, and portable institutions.

### 2.6 Power comes from recognition, duty, and service
Authority is produced by witnessed bonds, office, stewardship, fidelity, and collective recognition, not only by conquest or land flags.

---

## 3. Current Prototype to Target-Game Transition

## 3.1 Current Prototype Strengths
The current codebase already supports:
- server-authoritative world simulation
- chunk-based voxel terrain
- procedural generation
- player movement and interaction
- inventory and container logic
- mining / collection loops
- networked multiplayer state updates

These are enough to support the next-generation systems if the simulation model is expanded.

## 3.2 Current Prototype Constraints
The current implementation is still centered on:
- discrete block IDs
- discrete item IDs
- simple terrain generation
- chest-style containers
- break/place loops
- minimal NPC or social simulation

This is appropriate for an MVP, but insufficient for:
- invented non-recipe tools
- regionally distinct economies
- assembly-based shelter growth
- mobile sovereignty and fellowship systems
- long-term institutions and office

## 3.3 Core Transition Principle
Replace the design center:

From:
- block types
- item types
- recipes

Toward:
- materials
- forms
- operations
- assemblies
- structures
- institutions
- bonds
- claims
- recognition

---

## 4. Core Simulation Layers

The game should be built as interlocking layers.

### 4.1 Layer A — Terrain and Ecological Substrate
This layer generates the physical world and local affordances.

### 4.2 Layer B — Materials and Matter
This layer describes what substances exist and what can be done with them.

### 4.3 Layer C — Forms, Tools, and Assemblies
This layer turns matter into useful artifacts and structures.

### 4.4 Layer D — Structures, Settlements, and Stewardship
This layer tracks persistent built places and their upkeep.

### 4.5 Layer E — Skills, Practices, and Specializations
This layer governs practical capability, evaluation, and transmission of knowledge.

### 4.6 Layer F — Bonds, Fellowships, and Offices
This layer governs duties, rights, trust, and organized social labor.

### 4.7 Layer G — Sovereignty, Protection, and Recognition
This layer determines legitimacy, belonging, jurisdiction, and communal response.

---

## 5. Materials System

## 5.1 Goal
Enable powerful improvised and emergent crafting without relying on huge recipe lists.

## 5.2 Material Concepts
Every gatherable or processable substance is represented as a material with intrinsic and derived properties.

Examples:
- granite
- shale
- clay
- bog iron
- hardwood
- softwood
- reed fiber
- bark fiber
- sinew
- rawhide
- leather
- pitch
- resin
- charcoal
- copper ore
- bronze alloy
- bone
- antler
- shell

## 5.3 Material Property Families
Each material should expose numeric or categorical traits.

### Physical
- density
- hardness
- toughness
- brittleness
- elasticity
- flexibility
- compressive strength
- tensile strength
- abrasion resistance
- fracture pattern

### Surface / Process
- polishability
- sharpness potential
- grindability
- carveability
- split behavior
- binding affinity
- adhesive affinity
- absorbency
- porosity

### Environmental
- flammability
- insulation
- thermal mass
- water resistance
- rot resistance
- corrosion resistance
- freeze-thaw resistance

### Organic / Biological
- spoilage rate
- nutritional value
- medicinal properties
- toxicity
- fermentability
- fiber yield

### Cultural / Social Tags
- sacred status
- taboo status
- prestige level
- rarity perception
- fellowship-controlled
- sovereign resource

## 5.4 Material States
A material may exist in multiple states:
- raw
- processed
- refined
- compounded
- damaged
- weathered
- contaminated
- preserved

Examples:
- clay -> wedged clay -> fired ceramic -> glazed ceramic
- log -> split timber -> seasoned plank -> charred plank
- hide -> scraped hide -> tanned leather -> waxed leather

## 5.5 Material Compounding
Compounding combines materials into new composite substances.

Examples:
- clay + sand + temper -> ceramic body
- copper + tin -> bronze
- fiber + resin -> composite wrap
- charcoal + ore + flux -> smeltable charge
- ash + fat -> lye soap

Compounds should inherit modified traits rather than become arbitrary recipe outputs.

## 5.6 Material Data Model

```ts
class MaterialDefinition {
  id: string;
  name: string;
  category: MaterialCategory;
  baseProperties: MaterialPropertySet;
  processTags: string[];
  environmentalTags: string[];
  socialTags: string[];
  validStates: string[];
  sourceBiomeTags: string[];
  rarityCurve: RarityCurve;
}

class MaterialInstance {
  id: string;
  definitionId: string;
  state: string;
  quality: number;          // 0..100
  purity: number;           // 0..100
  moisture: number;         // 0..100
  temperature: number;
  contamination: string[];
  modifiers: MaterialModifier[];
  provenance: ProvenanceRecord;
  quantity: QuantityRecord;
}

class MaterialPropertySet {
  density: number;
  hardness: number;
  toughness: number;
  brittleness: number;
  flexibility: number;
  tensileStrength: number;
  compressiveStrength: number;
  carveability: number;
  splitBehavior: number;
  bindingAffinity: number;
  adhesiveAffinity: number;
  sharpnessPotential: number;
  flammability: number;
  insulation: number;
  waterResistance: number;
  rotResistance: number;
  spoilageRate: number;
  prestige: number;
}
```

---

## 6. Forms and Shaping System

## 6.1 Goal
Separate substance from form so that one material can become many functional objects and one function can be achieved by multiple material-form combinations.

## 6.2 Core Principle
A form is a shaped manifestation of material that supports one or more affordances.

Examples of forms:
- shard
- blade blank
- wedge
- hammer head
- pole
- shaft
- plank
- sheet
- cord
- rope
- basket body
- vessel
- tile
- brick
- pin
- peg
- hook
- ring
- frame
- panel

## 6.3 Shaping Operations
Operations convert materials or forms into other forms.

Examples:
- split
- chip
- knap
- carve
- shave
- plane
- drill
- grind
- polish
- weave
- braid
- twist
- lash
- stitch
- wrap
- cast
- press
- fire
- smelt
- forge
- temper
- laminate
- dry
- cure
- tan

Operations should require:
- tools
- workstations or environments
- skill thresholds
- time
- fuel / heat / labor

## 6.4 Functional Affordances
Forms produce gameplay-relevant affordances.

Examples:
- cutting
- digging
- pounding
- piercing
- carrying
- storing
- waterproofing
- insulating
- bracing
- spanning
- sealing
- filtering
- cooking
- drying
- grinding

## 6.5 Form Data Model

```ts
class FormDefinition {
  id: string;
  name: string;
  geometryClass: string;
  affordances: AffordanceDefinition[];
  assemblyRoles: string[];
  stackBehavior: string;
}

class FormInstance {
  id: string;
  materialInstanceIds: string[];
  formDefinitionId: string;
  dimensions: DimensionRecord;
  quality: number;
  wear: number;
  edgeSharpness?: number;
  structuralIntegrity: number;
  craftedBy?: EntityRef;
  discoveredPatternIds: string[];
}
```

---

## 7. Tools, Implements, and Invention

## 7.1 Goal
Support invention and discovery rather than only memorized recipes.

## 7.2 Tool Construction Principle
Tools are assemblies of forms and materials that satisfy functional thresholds.

Example:
A digging implement may require:
- penetration potential above threshold
- handle control above threshold
- overall durability above threshold

Possible solutions:
- hardwood shaft + antler tip + sinew wrap
- stone blade + split branch handle + resin + fiber binding
- bronze head + shaped haft + riveted socket

All qualify, but differ in:
- lifespan
- repairability
- prestige
- availability
- speed
- comfort
- weight

## 7.3 Discovery and Pattern Formalization
A player or NPC may:
- improvise a working assembly
- discover that it performs a role well
- name or record the pattern
- teach it to others
- make it culturally canonical without making it globally mandatory

Patterns are therefore social-technical knowledge, not immutable universal recipes.

## 7.4 Tool Data Model

```ts
class ToolCapabilityProfile {
  cutting: number;
  digging: number;
  hammering: number;
  prying: number;
  harvesting: number;
  shaping: number;
  carrying: number;
  heating: number;
  measuring: number;
}

class ArtifactDefinition {
  id: string;
  name: string;
  roleTags: string[];
  canonicalPatternIds: string[];
}

class ArtifactInstance {
  id: string;
  definitionId?: string;
  partIds: string[];
  capabilityProfile: ToolCapabilityProfile;
  quality: number;
  durability: number;
  repairability: number;
  ergonomics: number;
  prestige: number;
  legalStatusTags: string[];
  ownershipState?: OwnershipState;
}
```

---

## 8. Assemblies System

## 8.1 Goal
Represent compound objects and built artifacts as multi-part entities that can be improved, repaired, repurposed, or degraded.

## 8.2 Assembly Types
- handheld tools
- weapons
- garments
- packs
- furniture
- storage systems
- workstations
- wagons / sleds / boats
- shelters
- kilns
- fences
- gates
- bridges
- irrigation devices
- civic buildings

## 8.3 Assembly Traits
- structural integrity
- thermal performance
- weather resistance
- carrying capacity
- productivity multiplier
- maintainability
- repair cost
- mobility
- access control
- prestige / symbolic value

## 8.4 Joints and Methods
Assemblies should track how parts are joined.

Examples:
- pegged
- mortised
- lashed
- stitched
- riveted
- wedged
- socketed
- bonded with resin
- dry-stacked
- mud-sealed

The join method affects performance and failure modes.

## 8.5 Assembly Data Model

```ts
class AssemblyDefinition {
  id: string;
  name: string;
  category: string;
  roleTags: string[];
  requiredPartRoles: RequiredPartRole[];
  optionalPartRoles: OptionalPartRole[];
  performanceFormulas: PerformanceFormulaSet;
}

class AssemblyInstance {
  id: string;
  definitionId?: string;
  partRefs: AssemblyPartRef[];
  joints: JointRecord[];
  buildQuality: number;
  wear: number;
  environmentalExposure: number;
  performanceSnapshot: AssemblyPerformanceSnapshot;
  stewardRef?: EntityRef;
  accessPolicyRef?: EntityRef;
  legalStatusTags: string[];
}

class JointRecord {
  id: string;
  jointType: string;
  materialIds: string[];
  quality: number;
  stressLoad: number;
  failureRisk: number;
}
```

---

## 9. Structures and Built Environment

## 9.1 Goal
Make shelters, compounds, workshops, civic spaces, and infrastructure into evolving game entities.

## 9.2 Structure Philosophy
A structure is not a single placed object. It is a persistent world assembly with:
- spatial footprint
- function
- condition
- stewards
- permissions
- environmental interaction
- social meaning

## 9.3 Structure Categories
- temporary shelter
- household residence
- communal longhouse
- stockade
- workshop
- kiln / forge
- granary
- storehouse
- stable / pen
- irrigation channel
- bridge / causeway
- meeting hall
- shrine / ceremonial site
- watchtower
- market platform
- archive / records hut

## 9.4 Structure Systems
Each structure may provide some combination of:
- habitation
- storage
- crafting bonuses
- weather protection
- heat retention
- food preservation
- defense
- jurisdiction marker
- witness / ceremony venue
- office seat
- communal legitimacy

## 9.5 Incremental Improvement
Structures should support staged improvement:
- initial frame
- weather skin
- insulated walling
- drainage
- hearth / stove
- storage loft
- workbench integration
- fortification
- decorative prestige additions
- public function additions

## 9.6 Structure Data Model

```ts
class StructureInstance {
  id: string;
  name?: string;
  structureType: string;
  worldFootprint: VoxelFootprint;
  assemblyIds: string[];
  roomIds: string[];
  utilityProfile: StructureUtilityProfile;
  thermalProfile: ThermalProfile;
  storageCapacity: number;
  defenseProfile: DefenseProfile;
  upkeepProfile: UpkeepProfile;
  condition: number;
  quality: number;
  residentRefs: EntityRef[];
  stewardRefs: EntityRef[];
  sovereignClaimIds: string[];
  accessPolicyRef?: EntityRef;
  improvementHistory: ImprovementRecord[];
  culturalStyleTags: string[];
}

class StructureUtilityProfile {
  shelter: number;
  warmth: number;
  dryness: number;
  security: number;
  comfort: number;
  craftingSupport: number;
  foodPreservation: number;
  ceremonialCapacity: number;
  governanceCapacity: number;
}
```

---

## 10. Settlement and Infrastructure Systems

## 10.1 Goal
Allow social and material growth from camps to compounds to towns to regional polities.

## 10.2 Settlement Composition
A settlement emerges from:
- residence structures
- water systems
- food systems
- storage
- road/path networks
- workshops
- governance or witness spaces
- defense infrastructure
- institutions and offices

## 10.3 Settlement Metrics
- population support capacity
- food resilience
- shelter resilience
- maintenance burden
- defense readiness
- trade connectivity
- legitimacy / recognition
- specialization density
- hospitality capacity
- quorum viability

## 10.4 Infrastructure Types
- roads
- ferries
- bridges
- canals
- terraces
- field walls
- cisterns
- granaries
- signal towers
- caravan yards
- pasture circuits
- seasonal camps

## 10.5 Settlement Data Model

```ts
class SettlementInstance {
  id: string;
  name: string;
  settlementType: string;
  structureIds: string[];
  infrastructureIds: string[];
  residentEntityRefs: EntityRef[];
  householdIds: string[];
  institutionIds: string[];
  officeIds: string[];
  quorumRuleId?: string;
  territoryClaimIds: string[];
  specialtyIds: string[];
  hospitalityPolicyId?: string;
  riskProfile: SettlementRiskProfile;
  productivityProfile: ProductivityProfile;
  legitimacyProfile: LegitimacyProfile;
}
```

---

## 11. World and Regional Generation

## 11.1 Goal
Create a world where local material opportunities and constraints produce different societies and different technical solutions.

## 11.2 Regional Simulation Inputs
Each region should be generated from layered factors:
- geology
- topography
- hydrology
- climate
- seasonality
- flora composition
- fauna populations
- fuel availability
- disease / pest pressure
- navigability
- transport difficulty
- hazard profile

## 11.3 Region Effects
Regions influence:
- what raw materials occur
- how abundant or scarce they are
- what preservation methods are practical
- what building methods are viable
- what clothing and shelter styles are adaptive
- what trade routes are likely
- what specializations tend to emerge

## 11.4 Regional Specialties
A region’s specialties should emerge from actual affordances.

Examples:
- floodplain reedwork and basketry
- mountain stonework and terracing
- conifer timber framing and resin craft
- clay basin ceramics
- bog iron and charcoal metallurgy
- salt marsh preservation trade

## 11.5 Substitution Chains
The same gameplay need should have multiple valid regional solutions.

Examples:
Need: water-resistant container
- fired ceramic jar
- sealed bark basket
- leather bag with waxed seams
- pitch-lined wooden bucket

Need: durable digging implement
- bronze shovel
- antler hoe
- stone-adzed mattock
- hardwood fire-hardened spade

## 11.6 Region Data Model

```ts
class RegionProfile {
  id: string;
  bounds: WorldBounds;
  biomeBlend: BiomeWeightRecord[];
  geologyProfile: GeologyProfile;
  hydrologyProfile: HydrologyProfile;
  climateProfile: ClimateProfile;
  seasonalProfile: SeasonalProfile;
  floraTable: SpawnTable;
  faunaTable: SpawnTable;
  materialSourceTable: SpawnTable;
  hazardProfile: HazardProfile;
  transportProfile: TransportProfile;
  specialtyBiases: SpecialtyBias[];
  sovereigntyPressureMap: SovereigntyPressureMap;
}
```

---

## 12. Skills, Practice, and Mastery

## 12.1 Goal
Make expertise meaningful without collapsing the game into level-gating.

## 12.2 Skill Philosophy
Skills should mostly improve:
- perception
- precision
- yield
- consistency
- diagnosis
- repair
- teaching
- institutional legitimacy

Skills should not erase improvisation. A novice can attempt many things. A master can do them reliably, efficiently, and recognizably well.

## 12.3 Skill Domains
- gathering
- surveying
- stone shaping
- carpentry
- weaving
- tanning
- ceramics
- metallurgy
- cooking and preservation
- architecture
- animal tending
- healing
- diplomacy
- logistics
- witnessing / record-keeping
- adjudication
- public speaking
- fellowship leadership

## 12.4 Mastery and Recognition
Mastery should have two dimensions:
- practical capability
- social recognition

A brilliant self-taught craftsperson may have strong output but no fellowship standing.
A respected guild elder may hold institutional authority to certify others.

## 12.5 Skill Data Model

```ts
class SkillProfile {
  entityRef: EntityRef;
  domainRatings: Record<string, number>;
  discoveryTraits: Record<string, number>;
  pedagogyRatings: Record<string, number>;
  certificationIds: string[];
  fellowshipRecognitionIds: string[];
  titleIds: string[];
}
```

---

## 13. Knowledge, Patterns, and Cultural Transmission

## 13.1 Goal
Allow practical techniques to emerge, spread, diverge, and become cultural property.

## 13.2 Knowledge Types
- discovered material insight
- shaping method
- compound formulation
- assembly pattern
- architectural style
- preservation technique
- legal custom
- quorum custom
- route knowledge
- treaty precedent

## 13.3 Pattern Types
- private know-how
- household tradition
- fellowship standard
- open communal pattern
- sovereignly protected knowledge
- taboo / restricted pattern

## 13.4 Knowledge Data Model

```ts
class PatternRecord {
  id: string;
  name: string;
  patternType: string;
  domainTags: string[];
  requiredInputs: PatternInputRequirement[];
  operationSequence: PatternOperation[];
  expectedOutputs: PatternOutputProfile;
  discoveryRef?: EntityRef;
  culturalOwnerRefs: EntityRef[];
  transmissionPolicy: TransmissionPolicy;
  prestige: number;
}
```

---

## 14. Bonds and Oathbonds

## 14.1 Goal
Make agreements a mechanical foundation for labor, protection, office, economy, and sovereignty.

## 14.2 Bond Principle
A bond is a recognized relationship that grants rights, imposes duties, and changes how persons, groups, and institutions respond.

## 14.3 Bond Categories
- mutual aid pact
- apprenticeship
- patronage
- service vow
- residency bond
- household membership
- craft fellowship membership
- caravan compact
- defense covenant
- office commission
- stewardship delegation
- trade obligation
- guardianship / care duty
- ritual / ceremonial bond
- treaty between communities

## 14.4 Bond Fields
A bond may specify:
- parties
- witnesses
- scope
- rights granted
- duties owed
- duration
- renewal terms
- sanctions
- remedies
- compensation
- exemptions
- conflict venue
- recognition domains

## 14.5 Bond Fidelity
A crucial system variable is fidelity over time.

Fidelity measures whether the bond has been upheld under real pressure:
- service completed
- obligations honored
- absences explained
- emergency duties met
- resources not misused
- public behavior aligned with terms

High fidelity over time can grant:
- deeper trust
- extended privileges
- homeland-equivalent protections
- office eligibility
- witness credibility
- access to guarded resources

## 14.6 Bond Data Model

```ts
class BondRecord {
  id: string;
  bondType: string;
  partyRefs: EntityRef[];
  witnessRefs: EntityRef[];
  grantingBodyRef?: EntityRef;
  rightsGranted: RightGrant[];
  dutiesOwed: DutyGrant[];
  term: BondTerm;
  renewalPolicy: RenewalPolicy;
  sanctions: SanctionRecord[];
  compensationTerms: CompensationTerm[];
  recognitionDomainRefs: EntityRef[];
  fidelityScore: number;
  status: BondStatus;
  history: BondEvent[];
}
```

---

## 15. Fellowships, Households, and Community Membership

## 15.1 Goal
Support social belonging and specialization beyond simple factions.

## 15.2 Social Group Types
- household
- lineage / kin group
- fellowship
- guild-like craft association
- caravan band
- seasonal camp circle
- militia company
- shrine order
- settlement membership body
- distributed people / nation

## 15.3 Community Membership
Membership can be:
- natal
- resident
- bonded
- adopted
- probationary
- honorary
- office-bearing
- fellowship-limited
- route-affiliated

## 15.4 Membership Effects
- hospitality access
- protection rights
- quorum participation
- storage rights
- grazing / harvest access
- apprenticeship rights
- office eligibility
- burden sharing
- legal standing

## 15.5 Fellowship Data Model

```ts
class FellowshipRecord {
  id: string;
  name: string;
  fellowshipType: string;
  memberRefs: EntityRef[];
  specialtyDomainTags: string[];
  standardsPolicyId?: string;
  sharedResourceRefs: EntityRef[];
  internalOfficeIds: string[];
  mutualAidRules: MutualAidRule[];
  entryRules: EntryRule[];
  expulsionRules: ExpulsionRule[];
  recognitionDomains: EntityRef[];
}
```

---

## 16. Office, Delegation, and Quorum

## 16.1 Goal
Make public trust and delegated power into gameplay.

## 16.2 Office Principle
An office is a delegated bundle of powers and duties granted by a recognized body.

Examples:
- road warden
- granary steward
- witness-recorder
- bridge keeper
- caravan marshal
- kiln master
- harvest allocator
- peace speaker
- militia captain
- treaty witness

## 16.3 Office Fields
- granting body
- current holder
- jurisdiction
- powers
- duties
- term length
- compensation
- removal conditions
- accountability rules
- witness requirements

## 16.4 Quorum and Collective Action
Communities should define how collective legitimacy forms.

Possible quorum models:
- simple majority
- supermajority
- unanimity for high matters
- household-weighted
- office-weighted
- elder-weighted
- consensus with objection windows
- route-camp representation

## 16.5 Office Data Model

```ts
class OfficeRecord {
  id: string;
  title: string;
  grantingBodyRef: EntityRef;
  holderRef?: EntityRef;
  jurisdictionRefs: EntityRef[];
  delegatedRights: RightGrant[];
  delegatedDuties: DutyGrant[];
  startDate?: GameDate;
  endDate?: GameDate;
  compensationTerms: CompensationTerm[];
  appointmentRuleId?: string;
  removalRuleId?: string;
  legitimacyThreshold: number;
  auditPolicyId?: string;
}

class QuorumRule {
  id: string;
  bodyRef: EntityRef;
  eligibleMemberRefs: EntityRef[];
  thresholdType: string;
  thresholdValue: number;
  weightedBy?: string;
  witnessRequirement: number;
  emergencyOverridePolicy?: string;
}
```

---

## 17. Sovereignty System

## 17.1 Goal
Represent real, layered, contestable authority over places, institutions, people, offices, routes, and fields of expertise.

## 17.2 Sovereignty Principle
Sovereignty should be relational and recognized, not just painted territory ownership.

It should be assembled from:
- stewardship
- labor investment
- defense capacity
- bond recognition
- office legitimacy
- witness history
- resource control
- route control
- institutional continuity
- community acceptance

## 17.3 Sovereignty Domains
### Territorial sovereignty
Over land, fields, compounds, roads, forests, quarries, waterways.

### Institutional sovereignty
Over granaries, halls, shrines, workshops, archives, militias.

### Jurisdictional sovereignty
Over disputes, tolls, standards, ceremonies, record keeping, inheritance, apprenticeship.

### Specialization sovereignty
Recognized authority over a field of mastery.

### Relational sovereignty
Authority created through dense bond webs, mobile fellowships, patronage, and protection networks.

## 17.4 Sovereignty Claims
Claims may be:
- asserted
- witnessed
- recognized
- disputed
- dormant
- fragmented
- overlapping
- revoked

## 17.5 Sovereignty Claim Data Model

```ts
class SovereigntyClaim {
  id: string;
  claimantRef: EntityRef;
  sovereigntyType: string;
  scopeRef: EntityRef;
  basisTags: string[];
  supportingBondIds: string[];
  supportingOfficeIds: string[];
  recognitionScore: number;
  enforcementCapacity: number;
  challengerRefs: EntityRef[];
  status: ClaimStatus;
  history: ClaimEvent[];
}
```

---

## 18. Territorial, Mobile, and Portable Sovereignty

## 18.1 Goal
Support settled, nomadic, seasonal, and distributed peoples without reducing sovereignty to static borders.

## 18.2 Territorial Sovereignty
Applies to fixed places:
- fields
- compounds
- settlements
- quarries
- bridges
- roads
- harbor works

## 18.3 Mobile / Non-Territorial Sovereignty
Applies to:
- caravan confederacies
- nomadic groups
- distributed peoples
- seasonal camp societies
- pilgrimage orders
- moving defense bands
- fellowship networks

These groups may hold:
- route rights
- seasonal grazing claims
- camp-use rights
- internal law
- protection duties toward members
- recognized office-bearers
- witness authority across regions

## 18.4 Portable Sovereignty
Portable sovereignty means recognized authority travels with:
- officeholders
- caravans
- camps
- banners / tokens / signs
- witness records
- recognized protected persons

This enables a bonded person to receive home-like treatment away from their birthplace.

---

## 19. Belonging, Hospitality, and Homeland Equivalency

## 19.1 Goal
Make belonging and social protection more nuanced than faction reputation.

## 19.2 Distinct Social Measures
The system should track separately:
- affinity
- standing
- bond fidelity
- recognition
- hospitality status
- protection entitlement
- homeland equivalency

## 19.3 Homeland Equivalency
A person may earn treatment similar to a homeland member without being native-born.

This can be granted by:
- long bond fidelity
- singular dedication to a community
- office-bearing service
- adoption / sworn incorporation
- treaty-recognized status
- fellowship standing carried into allied communities

## 19.4 Hospitality Tiers
- unknown stranger
- tolerated outsider
- guest under safe conduct
- bonded outsider
- affiliated member
- honorary insider
- homeland-equivalent protected person
- public enemy / outlaw

## 19.5 Hospitality Data Model

```ts
class BelongingProfile {
  entityRef: EntityRef;
  ancestralHomeRefs: EntityRef[];
  residenceRefs: EntityRef[];
  bondedHomeRefs: EntityRef[];
  fellowshipDomainRefs: EntityRef[];
  homelandEquivalencyRefs: EntityRef[];
  protectionEntitlementScoreByDomain: Record<string, number>;
  hospitalityTierByDomain: Record<string, string>;
  outlawStatusByDomain: Record<string, boolean>;
}
```

---

## 20. Protection and Communal Response

## 20.1 Goal
Translate social belonging and legal status into concrete AI behavior and risk.

## 20.2 Protection Principle
When a player or NPC is threatened, nearby entities should not only ask “do I like them?”
They should ask:
- do I recognize them?
- what status do they hold here?
- do I owe them aid?
- do I owe aid to their bond partners or fellowship?
- is the attacker breaching peace?
- is the attacker unwelcome, outlawed, or oathbreaking?
- what is my risk if I intervene?
- are other obligated defenders nearby?

## 20.3 Example Outcomes
- ignore
- observe / witness
- raise alarm
- warn attacker
- offer sanctuary
- one defender intervenes
- many defenders mobilize
- officeholders are notified
- legal retaliation follows later

## 20.4 Protection Entitlement
A context-based score controlling:
- chance of NPC aid
- response speed
- size of defending group
- access to sanctuary
- witness reliability
- severity of retaliation against attackers

## 20.5 Protection Data Model

```ts
class ProtectionContextEvaluation {
  targetRef: EntityRef;
  attackerRef: EntityRef;
  domainRef: EntityRef;
  protectionEntitlement: number;
  peaceBreachSeverity: number;
  attackerHostilityStatus: string;
  availableDefenderRefs: EntityRef[];
  likelyResponseType: string;
}
```

---

## 21. Economy, Production, and Service

## 21.1 Goal
Produce an economy built from labor, materials, obligations, infrastructure, and specialization.

## 21.2 Economic Units
- material stocks
- processed goods
- assemblies and tools
- labor time
- service obligations
- transport access
- storage access
- risk-bearing
- protection guarantees
- office-backed authority

## 21.3 Service as Gameplay
A player may progress through:
- dedicated service to a household
- specialized labor for a community
- public office duties
- caravan support roles
- witness and record functions
- protection / defense / healing obligations

This makes community service a top-level progression path rather than a side feature.

## 21.4 Remuneration Types
- food shares
- shelter rights
- storage rights
- route access
- social standing
- office privileges
- material stipends
- trade priority
- protection entitlement
- land-use rights

## 21.5 Fields of Expertise and Spheres of Influence
Mastery can produce sovereignty-like influence over:
- craft standards
- access to specialist facilities
- apprenticeship validation
- dispute arbitration in a craft domain
- ceremonial production rights
- resource stewardship in a specialty

---

## 22. Conflict, Breach, and Undesirability

## 22.1 Goal
Make antisocial conduct matter socially and legally.

## 22.2 Negative Social States
- suspect
- unwelcome
- censured
- oathbreaker
- office-abuser
- contract-failer
- public enemy
- outlaw

## 22.3 Effects
- fewer hospitality rights
- reduced access to trade or refuge
- higher chance of local defenders aiding your victim
- lower credibility in disputes
- exclusion from quorum
- confiscation or sanctions
- community-wide alarm propagation

## 22.4 Breach System
Breaches may include:
- assault under peace
- theft from protected stores
- office dereliction
- failed service duty
- treaty violation
- sabotage of communal works
- craft fraud
- abandonment during bonded emergency

---

## 23. NPC and AI Social Simulation

## 23.1 Goal
Make NPCs participants in institutions and social logic rather than decorative vendors.

## 23.2 NPC Social Features
NPCs should have:
- affiliations
- obligations
- fear and risk tolerance
- office roles
- standing evaluations
- local custom awareness
- memory of witnessed events
- skill domains
- households and dependents

## 23.3 NPC Decision Inputs
- self-preservation
- bond duties
- office responsibilities
- fellowship expectations
- hospitality custom
- material need
- public reputation consequences
- current force balance

## 23.4 Emergent Results
- defenders rallying around protected persons
- stewards responding to theft
- witness disputes
- office vacancy crises
- fellowship schisms
- migration and settlement branching
- treaty cascades

---

## 24. Progression Model

## 24.1 Goal
Support multiple equally valid advancement arcs.

## 24.2 Progression Axes
### Material progression
Better evaluation, compounding, shaping, preservation, and repair.

### Structural progression
Building more robust, comfortable, useful, and defensible structures.

### Social progression
Growing trust, fidelity, hospitality, and belonging.

### Institutional progression
Holding office, stewarding infrastructure, leading quorum, representing fellowship.

### Sovereignty progression
Gaining recognized authority over domains, places, routes, or craft specializations.

### Cultural progression
Discovering, naming, teaching, and institutionalizing practices.

## 24.3 Endgame Possibilities
- master craft innovator
- regional steward-builder
- caravan diplomat
- treaty witness and recorder
- community healer
- defense coordinator
- public granary officeholder
- distributed fellowship leader
- founder of a new settlement tradition

---

## 25. Data Entity Catalog

The game should eventually support these major entity classes.

### World / ecology
- RegionProfile
- SubRegionProfile
- MaterialSourceNode
- RouteNetwork
- HazardZone

### Matter / craft
- MaterialDefinition
- MaterialInstance
- FormDefinition
- FormInstance
- PatternRecord
- ArtifactInstance
- AssemblyInstance

### Built world
- StructureInstance
- InfrastructureInstance
- SettlementInstance
- HouseholdRecord

### Social / institutional
- BondRecord
- FellowshipRecord
- OfficeRecord
- QuorumRule
- SovereigntyClaim
- BelongingProfile
- HospitalityPolicy
- ProtectionContextEvaluation

### Actors
- PlayerCharacter
- NPCCharacter
- CommunityRecord
- PolityRecord

---

## 26. Proposed Server-Side Domain Model

A practical Python-oriented domain model for the existing server architecture could evolve toward modules like:

```python
world/
  regions.py
  terrain.py
  climate.py
  hydrology.py
  materialsources.py

materials/
  definitions.py
  instances.py
  properties.py
  compounds.py
  operations.py

craft/
  forms.py
  patterns.py
  assemblies.py
  artifacts.py
  workstations.py

settlement/
  structures.py
  infrastructure.py
  households.py
  settlements.py
  stewardship.py

social/
  bonds.py
  fellowships.py
  offices.py
  quorum.py
  hospitality.py
  sovereignty.py
  sanctions.py

actors/
  player.py
  npc.py
  memory.py
  skills.py
  identity.py

economy/
  logistics.py
  stocks.py
  labor.py
  exchange.py
```

---

## 27. Message and Networking Implications

## 27.1 Near-Term Approach
Do not send the full simulation to every client.
Use interest management and summarized state.

## 27.2 New Domain Message Categories
- MATERIAL_DISCOVERED
- ASSEMBLY_UPDATED
- STRUCTURE_CHANGED
- SETTLEMENT_STATUS
- BOND_OFFERED
- BOND_ACCEPTED
- BOND_BREACH
- OFFICE_GRANTED
- QUORUM_CALLED
- CLAIM_ASSERTED
- CLAIM_CONTESTED
- HOSPITALITY_STATUS
- PROTECTION_ALERT
- SANCTION_ISSUED

## 27.3 Authority Boundaries
Server remains authoritative for:
- material transformations
- structure state
- bond legality and status
- office and quorum outcomes
- sovereignty claims and recognition
- social hostility / outlaw status

---

## 28. Persistence Strategy

## 28.1 Persistence Needs
The target game requires durable storage for:
- region seeds and generated profiles
- structure histories
- material stocks and compounds
- pattern discoveries
- social graphs
- bond histories
- office chains
- sanctions and claims
- settlement institutions

## 28.2 Persistence Suggestion
Move from in-memory state toward a hybrid model:
- chunk / terrain persistence
- entity tables or document records
- append-only event history for social and legal systems
- snapshots for fast load

Important subsystems such as bonds, claims, offices, and structure improvements will benefit from event sourcing or audit-log style histories.

---

## 29. MVP-to-Target Roadmap

## Phase 1 — Prototype Stabilization
- fix movement / collision / spawning reliability
- unify shared types and project layout
- add persistence for chunks and basic entities
- formalize server-side entity registry

## Phase 2 — Material and Form Foundation
- introduce MaterialDefinition / MaterialInstance
- introduce FormDefinition / FormInstance
- convert some items from static IDs to material-backed forms
- add basic shaping operations

## Phase 3 — Assembly and Structure Evolution
- create AssemblyInstance model
- implement staged shelter and workstation construction
- add maintenance and repair
- add stewardship and access control

## Phase 4 — Regions and Specialization
- generate region profiles
- connect biome/geology/hydrology to materials
- add substitution chains and local specialties
- begin NPC production behavior

## Phase 5 — Social Contract Layer
- implement bonds, fellowships, and community membership
- add office and quorum rules
- add sanctions and breach tracking
- tie hospitality and protection to bond fidelity

## Phase 6 — Sovereignty and Mobile Polities
- implement sovereignty claims
- support route-based and portable sovereignty
- add homeland equivalency, hospitality tiers, and protection entitlement
- model settled and nomadic political forms

## Phase 7 — Institutional and Emergent Endgame
- adjudication and treaty systems
- advanced NPC institutional behavior
- inter-community diplomacy
- settlement branching, schism, federation, and confederacy systems

---

## 30. Near-Term Implementation Recommendations for This Codebase

### 30.1 First Technical Refactors
1. Create a canonical shared-types module and remove duplication.
2. Introduce dataclasses / typed objects for domain entities instead of loose dicts.
3. Separate world generation from block definitions.
4. Add persistent IDs for items, containers, assemblies, and structures.

### 30.2 First New Systems Worth Building
1. MaterialDefinition + MaterialInstance
2. FormDefinition + FormInstance
3. Simple work actions: split, carve, lash, weave, fire-harden
4. StructureInstance for shelters and storage
5. BondRecord for mutual aid and residency

### 30.3 First Playable Design Slice
A good early slice would be:
- gather wood, stone, reeds, hide, resin
- shape them into poles, cords, blades, panels
- assemble shelter frames and basic tools
- establish a household camp
- create simple mutual-aid and shared-storage bonds
- have NPCs respect or contest those rights

That slice expresses the target game much better than adding a large recipe list.

---

## 31. Final Design Statement

This project should evolve into a multiplayer simulation where players do not merely craft predefined items. They discover workable forms by transforming local materials into tools, structures, and institutions; they bind themselves into households, fellowships, and offices; and they build legitimacy, belonging, and sovereignty through stewardship, fidelity, service, recognition, and collective action across both settled and mobile communities.

That is the core identity of this game.

