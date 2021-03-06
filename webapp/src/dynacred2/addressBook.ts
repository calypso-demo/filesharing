/**
 * AddressBook holds the contacts, groups and actions of a user.
 */
import {BehaviorSubject} from "rxjs";
import Long from "long";

import {InstanceID} from "src/lib/byzcoin";
import {CoinInstance} from "src/lib/byzcoin/contracts";
import {Darc, IdentityDarc, IIdentity} from "src/lib/darc";

import {AttributeInstanceSetBS, CredentialStructBS, EAttributesPublic, ECredentials} from "./credentialStructBS";
import {DarcBS, DarcsBS} from "./byzcoin/darcsBS";
import {UserSkeleton} from "./userSkeleton";
import {CoinBS} from "./byzcoin/coinBS";
import {CredentialTransaction} from "./credentialTransaction";

export class AddressBook {
    constructor(public readonly contacts: ABContactsBS,
                public readonly groups: ABGroupsBS,
                public readonly actions: ABActionsBS
    ) {
    }
}

export class ABContactsBS extends BehaviorSubject<CredentialStructBS[]> {
    constructor(
        private ais: AttributeInstanceSetBS,
        bscs: BehaviorSubject<CredentialStructBS[]>
    ) {
        super(bscs.getValue());
        bscs.subscribe(this);
    }

    public create(tx: CredentialTransaction, user: UserSkeleton, initial = Long.fromNumber(0)) {
        tx.createUser(user, initial);
        this.link(tx, user.credID);
    }

    public link(tx: CredentialTransaction, id: InstanceID) {
        this.ais.setInstanceSet(tx, this.ais.getValue().add(id));
    }

    public unlink(tx: CredentialTransaction, id: InstanceID) {
        this.ais.setInstanceSet(tx, this.ais.getValue().rm(id));
    }

    public rename(tx: CredentialTransaction, oldName: string, newName: string) {
        const d = this.getValue().find(d => d.credPublic.alias.getValue() === oldName);
        if (!d) {
            throw new Error("couldn't find group with that name");
        }
        d.updateCredential(tx, {cred: ECredentials.pub, attr: EAttributesPublic.alias, value: Buffer.from(newName)});
    }
}

export class ABGroupsBS extends DarcsBS {
    constructor(
        private ais: AttributeInstanceSetBS,
        dbs: DarcsBS) {
        super(dbs)
    }

    public find(name: string): DarcBS | undefined {
        return this.getValue().find(dbs => dbs.getValue().description.toString().match(`/\w${name}$/`))
    }

    public create(tx: CredentialTransaction, name: string, signers: IIdentity[]): Darc {
        const d = tx.spawnDarcBasic(name, signers);
        this.link(tx, d.getBaseID());
        return d;
    }

    public link(tx: CredentialTransaction, id: InstanceID) {
        this.ais.setInstanceSet(tx, this.ais.getValue().add(id));
    }

    public unlink(tx: CredentialTransaction, id: InstanceID) {
        this.ais.setInstanceSet(tx, this.ais.getValue().rm(id));
    }

    public rename(tx: CredentialTransaction, oldName: string, newName: string) {
        const d = this.getValue().find(d => d.getValue().description.equals(Buffer.from(oldName)));
        if (!d) {
            throw new Error("couldn't find group with that name");
        }
        d.evolve(tx, {description: Buffer.from(newName)});
    }
}

export class ABActionsBS extends BehaviorSubject<ActionBS[]> {
    constructor(
        private ais: AttributeInstanceSetBS,
        abs: BehaviorSubject<ActionBS[]>
    ) {
        super(abs.getValue());
        abs.subscribe(this);
    }

    public create(tx: CredentialTransaction, desc: string, signers: IIdentity[]) {
        const signDarc = tx.spawnDarcBasic(desc, signers);
        const signDarcID = new IdentityDarc({id: signDarc.id});
        const coinDarc = Darc.createBasic([], [signDarcID], Buffer.from(`${name}:coin`),
            [`invoke:${CoinInstance.contractID}.${CoinInstance.commandTransfer}`]);
        tx.spawnDarc(coinDarc);
        const coinID = Buffer.from(`${name}:coin`);
        tx.spawnCoin(coinID, coinDarc.getBaseID());
        this.link(tx, signDarc.getBaseID());
    }

    public link(tx: CredentialTransaction, id: InstanceID) {
        this.ais.setInstanceSet(tx, this.ais.getValue().add(id));
    }

    public unlink(tx: CredentialTransaction, id: InstanceID) {
        this.ais.setInstanceSet(tx, this.ais.getValue().rm(id));
    }

    public rename(tx: CredentialTransaction, oldName: string, newName: string) {
        const action = this.getValue().find(a => a.darc.getValue().description.equals(Buffer.from(oldName)));
        if (!action) {
            throw new Error("couldn't find this action");
        }
        action.darc.evolve(tx, {description: Buffer.from(newName)});
    }
}

/**
 * TODO: Need to link CoinBS somewhere in the Credential - currently it's not stored!
 */
export class ActionBS {
    constructor(
        public darc: DarcBS,
        public coin?: CoinBS) {
    }
}
